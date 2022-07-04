const { BigQuery } = require("@google-cloud/bigquery");
const { JobLoadMetadata } = require("@google-cloud/bigquery/build/src/table");

const { BIGQUERY_PROJECTID, BIGQUERY_KEYFILE, BIGQUERY_DATASET, NODE_ENV} = process.env;

const createBigQueryConnection = () => {
  const settings = {
    projectId: BIGQUERY_PROJECTID
  };
  if (NODE_ENV === "development") {
    settings.keyFilename = BIGQUERY_KEYFILE;
  }

  return new BigQuery(settings);
};

const bigqueryConnection = createBigQueryConnection();

const saveDataset = async (path, tableName, cb) => {
  const bigQueryMetaData = {
    // writeDisposition: "WRITE_TRUNCATE",
    autodetect: true,
    sourceFormat: "CSV",
    fieldDelimiter: ';',
    skipLeadingRows: 1,
    allowJaggedRows: true,
    allowQuotedNewlines: true,
    ignoreUnknownValues: true,
  };
  try {
    return await bigqueryConnection
      .dataset(BIGQUERY_DATASET)
      .table(tableName)
      .createLoadJob(path, bigQueryMetaData, cb);
  } catch(e) {
    console.error('BigQuery', e);
  }
}

const deleteRows = async (table, condition = {}) => {
  let query = `DELETE FROM ${BIGQUERY_DATASET}.${table}`
  const where = [];
  for (const key in condition) {
    where.push(`${key} = '${condition[key]}'`);
  }
  if (where.length) {
    query += ` WHERE ${where.join(' AND ')}`;
  }

  try {
    await bigqueryConnection.query(query);
  } catch (e) {
    console.error('BigQuery', e);
  }
}

module.exports = {
  saveDataset, deleteRows
}
