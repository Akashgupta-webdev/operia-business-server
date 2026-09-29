import mongoose from "mongoose";
import ClientService from "../models/clientService.model.js";
import ClientDocument from "../models/clientDocuments.model.js";
import ClientReminder from "../models/clientReminder.model.js";
import { ClientServiceNotFoundError } from "../errors/clientService.error.js";
import { ClientVatError, normalizeVatError } from "../errors/clientVat.error.js";
import { assertVatVersion, parseVatDate, VAT_SERVICE_CODE, vatToday } from "../utils/clientVat.utils.js";
import { applyVatAction } from "../utils/clientVatWorkflow.utils.js";
import { prepareVatServiceCreation, validateVatAssignee } from "./clientVatCreation.service.js";

// Loads a VAT service through the same identity filter for reads and commands.
// Generic legacy service records cannot accidentally enter the VAT workflow.
const loadVatService = async (serviceId, session = null) => {
  const service = await ClientService.findOne({ _id: serviceId, serviceCode: VAT_SERVICE_CODE }).session(session).exec();
  if (!service) throw new ClientServiceNotFoundError();
  return service;
};

// Requires evidence uploaded for this exact Client, filing and document purpose.
// Service-linked evidence is retained, preventing deletion between check and commit.
export const validateVatEvidence = async (service, documentIds, purpose, session = null) => {
  const ids = [...new Set(documentIds.map(String))];
  const count = await ClientDocument.countDocuments({ _id: { $in: ids }, client: service.client, service: service._id, purpose }).session(session).exec();
  if (count !== ids.length) throw new ClientVatError("VAT_EVIDENCE_REQUIRED", "Evidence must belong to this filing and have the required purpose.");
};

// Builds indexed VAT filters with calendar dates and deterministic pagination.
// Statutory deadlines are separate from internal targets and legacy expiry dates.
export const buildVatListFilter = (query) => {
  const filter = { serviceCode: VAT_SERVICE_CODE };
  for (const field of ["client", "company", "assignedTo", "status"]) if (query[field]) filter[field] = query[field];
  if (query.stage) filter["details.vat.stage"] = query.stage;
  if (query.fromDate || query.toDate) {
    filter.dueDate = {};
    if (query.fromDate) filter.dueDate.$gte = parseVatDate(query.fromDate);
    if (query.toDate) filter.dueDate.$lte = parseVatDate(query.toDate);
    if (filter.dueDate.$gte > filter.dueDate.$lte) throw new ClientVatError("VALIDATION_FAILED", "fromDate must not follow toDate.");
  }
  return filter;
};

// Lists VAT obligations with bounded page/limit pagination and stable ordering.
// The extra row determines whether another page is available without a count scan.
export const listVatServices = async (query) => {
  const rows = await ClientService.find(buildVatListFilter(query)).sort({ dueDate: 1, _id: 1 }).skip((query.page - 1) * query.limit).limit(query.limit + 1).exec();
  return { data: rows.slice(0, query.limit), page: { number: query.page, limit: query.limit, hasMore: rows.length > query.limit } };
};

// Returns a single VAT service together with its retained evidence and reminder.
// Existing Client detail responses continue to contain all related records too.
export const getVatService = async (serviceId) => {
  const service = await loadVatService(serviceId);
  const [documents, reminder] = await Promise.all([
    ClientDocument.find({ service: serviceId, client: service.client }).sort({ createdAt: 1, _id: 1 }).exec(),
    ClientReminder.findOne({ service: serviceId, client: service.client }).exec(),
  ]);
  return { service, documents, reminder };
};

// Counts outstanding filing obligations through the next 60 Dubai calendar days.
// Overdue work is included; filed and cancelled work never contributes.
export const countVatDue = (now = new Date()) => {
  const through = vatToday(now);
  through.setUTCDate(through.getUTCDate() + 60);
  return ClientService.countDocuments({ serviceCode: VAT_SERVICE_CODE, status: { $nin: ["Completed", "Cancelled"] }, dueDate: { $lte: through } }).exec();
};

// Executes one versioned VAT command and all related writes atomically.
// A replica-set transaction prevents duplicate successors and partial reminder changes.
export const executeVatAction = async (serviceId, action, input, actor, now = new Date()) => {
  try {
    return await mongoose.connection.transaction(async (session) => {
      const service = await loadVatService(serviceId, session);
      assertVatVersion(service, input.expectedVersion);
      if (action === "prepare") {
        await validateVatEvidence(service, [input.workingPaper], "WORKING_PAPER", session);
        await validateVatEvidence(service, input.sourceDocuments, "SOURCE", session);
      }
      const purposes = { "record-approval": "APPROVAL", "record-submission": "ACKNOWLEDGMENT", "record-tax-payment": "TAX_PAYMENT" };
      if (purposes[action]) await validateVatEvidence(service, [input.document], purposes[action], session);
      if (action === "assign") await validateVatAssignee(input.assignedTo, session);
      applyVatAction(service, action, input, actor, now);
      let nextService;
      if (action === "create-next-period") {
        const values = await prepareVatServiceCreation(service.client, {
          serviceCode: VAT_SERVICE_CODE, category: service.category, package: service.package,
          company: String(service.company), assignedTo: service.assignedTo,
          dueDate: input.dueDate, details: { vat: { periodStart: input.periodStart, periodEnd: input.periodEnd } },
        }, { session });
        [nextService] = await ClientService.create([{ ...values, client: service.client, previousService: service._id }], { session });
      }
      if (action === "revise-period" && service.previousService) {
        const previous = await loadVatService(service.previousService, session);
        if (service.details.vat.periodStart <= previous.details.vat.periodEnd) throw new ClientVatError("VALIDATION_FAILED", "The next period cannot overlap its predecessor.");
      }
      if (action === "schedule-reminder") {
        await ClientReminder.findOneAndUpdate(
          { service: service._id },
          { $set: { client: service.client, service: service._id, followupDate: input.followupDate, scheduledFor: parseVatDate(input.followupDate), state: "PENDING", notes: input.notes }, $unset: { completedAt: 1 } },
          { upsert: true, runValidators: true, session },
        );
      }
      if (action === "complete-reminder") {
        const reminder = await ClientReminder.findOneAndUpdate({ service: service._id, state: "PENDING" }, { $set: { state: "COMPLETED", completedAt: now } }, { session });
        if (!reminder) throw new ClientVatError("INVALID_TRANSITION", "There is no pending reminder to complete.");
      }
      if (["record-submission", "cancel"].includes(action)) await ClientReminder.updateOne({ service: service._id, state: "PENDING" }, { $set: { state: "CANCELLED" } }, { session });
      await service.save({ session });
      return { service, ...(nextService ? { nextService } : {}) };
    });
  } catch (error) {
    throw normalizeVatError(error);
  }
};
