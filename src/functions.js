const { createObjectCsvWriter } = require("csv-writer");
const moment = require('moment');
const { connection } = require('./connection');
const { saveDataset, deleteRows } = require('./bigQuery');
const reportConfig = require(`../config${ process.env.NODE_ENV === 'development' ? '.dev' : '' }.json`);
const queries = require('./queries');
const afterQuery = require('./afterQuery');

const createCSV = async ({path, fields, rows}) => {
  const header = fields.map(field => ({
    id: field.name, title: field.name
  }));
  await createObjectCsvWriter({ path, header, fieldDelimiter: ';' }).writeRecords(rows);
}


const main = async ({reportDate = null} = {}) => {
  try {
    const date = reportDate || moment().subtract(1, 'days').format('YYYY-MM-DD');
    console.log('report date: ', date);
    await connection.query(queries.setReportDate(date));

    for (const key in reportConfig) {
      if (key in queries && typeof queries[key] === "function") {
        console.log('Report: ', key);
        const sql = queries[key](reportConfig[key]);
        let [rows, fields] = await connection.query(sql);
        const aqFn = `${key}AfterQuery`;
        if (aqFn in afterQuery && typeof afterQuery[aqFn] === "function") {
          [rows, fields] = afterQuery[aqFn](rows, fields, reportConfig[key]);
        }
        console.log('Queried rows: ', rows.length);
        const path = (process.env.NODE_ENV === 'development' ? '.' : '') + `/tmp/${key}.csv`;
        await createCSV({ path, fields, rows });
        await deleteRows(key, { reportDate: date })
        const [, job] = await saveDataset(path, key);
        console.log('BQ status: ', job.status);
        console.log('Done');
      }
    }
    console.log('Finished');
  } catch (e) {
    console.error(e.message);
  } finally {
    await connection.end();
  }
}

module.exports = {
  main
}
