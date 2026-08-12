import logger from "../../../logger/index.js";
import { ClientNotFoundError } from "../../clients/errors/client.error.js";
import Client from "../../clients/models/client.model.js";
import Company from "../models/company.model.js";

const toCompanyRepresentation = (company) => {
  const representation = {
    ...company,
    id: company._id.toString(),
    client: company.client.toString(),
  };

  delete representation._id;
  return representation;
};

export const creatingCompany = async (req, res, next) => {
  try {
    const clientExists = await Client.exists({ _id: req.body.client }).exec();

    if (!clientExists) {
      throw new ClientNotFoundError();
    }

    const company = await Company.create(req.body);

    logger.info("Company created.", {
      companyId: company.companyId,
      clientId: req.body.client,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    res.location(`/api/v1/companies/${company.companyId}`);
    res.set("ETag", `"${company.version}"`);
    return res.status(201).json({
      data: company,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    logger.error("Company creation failed.", {
      errorName: error.name,
      errorCode: error.code,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};

export const getCompaniesByClient = async (req, res, next) => {
  try {
    const { clientId } = req.validatedParams;
    const { page, limit } = req.validatedQuery;
    const clientExists = await Client.exists({ _id: clientId }).exec();

    if (!clientExists) {
      throw new ClientNotFoundError();
    }

    const filter = { client: clientId };
    const skip = (page - 1) * limit;
    const [companies, total] = await Promise.all([
      Company.find(filter)
        .sort({ createdAt: -1, companyId: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Company.countDocuments(filter).exec(),
    ]);

    return res.status(200).json({
      data: companies.map(toCompanyRepresentation),
      page: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    logger.error("Company list lookup by Client failed.", {
      errorName: error.name,
      errorCode: error.code,
      clientId: req.params.clientId,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};
