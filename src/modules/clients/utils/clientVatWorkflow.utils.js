import { ClientVatError } from "../errors/clientVat.error.js";
import { formatVatAmount, parseVatDate, validateVatPeriod, vatMinorUnits, vatToday } from "./clientVat.utils.js";

// Checks the current stage before advancing a filing.
// Cancelled services are also blocked by the command entry guard.
const requireStage = (vat, stages) => {
  if (!stages.includes(vat.stage)) throw new ClientVatError("INVALID_TRANSITION", "Action is not allowed at the current filing stage.");
};

// Invalidates review and approval whenever the approved draft changes.
// Calculation revision is retained so old approvals cannot authorize filing.
const resetVatReview = (vat) => {
  vat.review = undefined;
  vat.approval = undefined;
  vat.stage = "PREPARING";
};

// Applies deterministic lifecycle rules independently of HTTP and persistence.
// The service validates evidence ownership before applying these transitions.
export const applyVatAction = (service, action, input, actor, now = new Date()) => {
  const vat = service.details.vat;
  if (service.status === "Cancelled" && action !== "reopen") throw new ClientVatError("INVALID_TRANSITION", "Reopen this cancelled filing first.");
  if (vat.stage === "FILED" && !["record-tax-payment", "create-next-period", "assign"].includes(action)) throw new ClientVatError("VAT_FILED_LOCKED", "Filed return data is immutable.", 409);
  const event = { action, actor, at: now, revision: vat.revision, reason: input.reason };
  switch (action) {
    case "prepare": {
      const net = vatMinorUnits(input.outputVat) - vatMinorUnits(input.recoverableInputVat);
      vat.calculation = { outputVat: input.outputVat, recoverableInputVat: input.recoverableInputVat, netVat: formatVatAmount(net), workingPaper: input.workingPaper, sourceDocuments: input.sourceDocuments };
      vat.revision += 1;
      resetVatReview(vat);
      vat.settlement = { status: net > 0n ? "UNPAID" : net < 0n ? "CREDIT" : "NOT_DUE", amountPaid: "0.00" };
      service.status = "In Progress";
      event.document = input.workingPaper;
      break;
    }
    case "request-review":
      requireStage(vat, ["PREPARING"]);
      if (!vat.calculation?.workingPaper || !vat.calculation.sourceDocuments?.length) throw new ClientVatError("VAT_EVIDENCE_REQUIRED", "Prepare the calculation with source records first.");
      vat.stage = "INTERNAL_REVIEW";
      break;
    case "approve-review":
      requireStage(vat, ["INTERNAL_REVIEW"]);
      vat.review = { actor, at: now, revision: vat.revision };
      vat.stage = "AWAITING_CLIENT_APPROVAL";
      break;
    case "record-approval":
      requireStage(vat, ["AWAITING_CLIENT_APPROVAL"]);
      if (vat.review?.revision !== vat.revision) throw new ClientVatError("VAT_REVIEW_REQUIRED", "Review the current calculation first.");
      vat.approval = { name: input.approverName, document: input.document, revision: vat.revision, recordedBy: actor, recordedAt: now };
      vat.stage = "READY_TO_FILE";
      event.document = input.document;
      break;
    case "record-submission": {
      requireStage(vat, ["READY_TO_FILE"]);
      if (vat.approval?.revision !== vat.revision) throw new ClientVatError("VAT_APPROVAL_REQUIRED", "Approve the current calculation first.");
      const submittedOn = parseVatDate(input.submittedOn);
      if (submittedOn < vat.periodEnd || submittedOn > vatToday(now)) throw new ClientVatError("VALIDATION_FAILED", "Submission date must be on or after period end and not in the future.");
      vat.submission = { reference: input.reference, submittedOn, acknowledgment: input.document, recordedBy: actor, recordedAt: now };
      vat.stage = "FILED";
      service.status = "Completed";
      event.reference = input.reference;
      event.document = input.document;
      break;
    }
    case "record-tax-payment": {
      requireStage(vat, ["FILED"]);
      const net = vatMinorUnits(vat.calculation.netVat);
      const paid = vatMinorUnits(input.amountPaid);
      const paidOn = parseVatDate(input.paidOn);
      if (net <= 0n || paid < 0n || paid > net) throw new ClientVatError("VALIDATION_FAILED", "Payment must be between zero and the positive net VAT due.");
      if (paidOn < vat.periodEnd || paidOn > vatToday(now)) throw new ClientVatError("VALIDATION_FAILED", "Payment date must be on or after period end and not in the future.");
      if (vat.settlement?.document && !input.reason) throw new ClientVatError("VALIDATION_FAILED", "Provide a reason when replacing a payment record.");
      vat.settlement = { status: paid === net ? "PAID" : paid > 0n ? "PARTIAL" : "UNPAID", amountPaid: input.amountPaid, paidOn, document: input.document };
      event.amount = input.amountPaid;
      event.document = input.document;
      break;
    }
    case "return-for-correction":
      resetVatReview(vat);
      service.status = "In Progress";
      break;
    case "revise-period": {
      const start = parseVatDate(input.periodStart), end = parseVatDate(input.periodEnd), due = parseVatDate(input.dueDate);
      validateVatPeriod(start, end, due);
      vat.periodStart = start;
      vat.periodEnd = end;
      service.dueDate = due;
      vat.calculation = undefined;
      vat.settlement = undefined;
      vat.revision += 1;
      resetVatReview(vat);
      service.status = "In Progress";
      break;
    }
    case "cancel":
      service.status = "Cancelled";
      vat.review = undefined;
      vat.approval = undefined;
      break;
    case "reopen":
      if (service.status !== "Cancelled") throw new ClientVatError("INVALID_TRANSITION", "Only cancelled filings can be reopened.");
      resetVatReview(vat);
      service.status = "In Progress";
      break;
    case "assign":
      service.assignedTo = input.assignedTo;
      break;
    case "create-next-period":
      requireStage(vat, ["FILED"]);
      if (parseVatDate(input.periodStart) <= vat.periodEnd) throw new ClientVatError("VALIDATION_FAILED", "The next period must start after the previous period.");
      break;
    case "schedule-reminder":
    case "complete-reminder":
      break;
    default:
      throw new ClientVatError("INVALID_TRANSITION", "Unknown VAT action.");
  }
  event.revision = vat.revision;
  event.periodStart = vat.periodStart;
  event.periodEnd = vat.periodEnd;
  event.dueDate = service.dueDate;
  if (action === "prepare") event.calculation = vat.calculation?.toObject ? vat.calculation.toObject() : { ...vat.calculation };
  if (action === "record-approval") event.approval = vat.approval?.toObject ? vat.approval.toObject() : { ...vat.approval };
  if (action === "schedule-reminder") { event.scheduledFor = parseVatDate(input.followupDate); event.notes = input.notes; }
  if (action === "assign") event.assignedTo = input.assignedTo;
  vat.history.push(event);
  return service;
};
