const PHPUnserialize = require('phpunserialize');

const fieldChangesAfterQuery = (rows, originFields, { fieldAliases }) => {
  const newRows = rows.map(({ reportDate, details, leadId, dateAdded }) => {
    const { fields } = PHPUnserialize(details);
    for (let fieldName of fieldAliases) {
      const { 0: oldValue, 1: newValue } = fields[fieldName];
      return {
        reportDate,
        leadId,
        fieldName,
        oldValue,
        newValue,
        dateAdded
      }
    }
  });

  if (newRows) {
    const fields = Object.keys(newRows[0]).map(name => ({ name }) )
    return [ newRows, fields ];
  }

  return [rows, originFields];
}

module.exports = {
  fieldChangesAfterQuery
}
