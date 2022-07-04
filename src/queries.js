const setReportDate = (reportDate) => `SET @reportDate = '${reportDate}';`;

const totalPotentials = () => `
  SELECT @reportDate reportDate,
       COUNT(*) totalPotentials
  FROM leads
  WHERE DATE(date_added) = @reportDate
    AND date_identified IS NOT NULL
`;

const purchasesAndRejections = ({purchaseId, rejectionId}) => `
SELECT @reportDate reportDate,
       lead_id,
       date_added,
       action,
       IF(object_id=${purchaseId}, 'Purchases' , 'Rejections') type
FROM lead_event_log
WHERE DATE(date_added)=@reportDate
  AND object='segment'
  AND object_id IN (${purchaseId}, ${rejectionId})
`;

const emails = ({inputs}) => {
  const sql = ({name, emailIds}) => `
  SELECT @reportDate reportDate,
       '${name}' periodOfTime,
       es.email_id,
       es.lead_id,
       es.date_sent,
       IF(DATE(es.date_sent)=@reportDate, 'send', null) isSend,
       es.date_read,
       IF(DATE(es.date_read)=@reportDate, 'clicked', null) isClicked,
       ph.date_hit clickDate,
       null isRead
FROM email_stats es
         LEFT JOIN (
    SELECT MAX(date_hit) date_hit, email_id, lead_id
    FROM page_hits
    GROUP BY lead_id, email_id
) ph on es.email_id = ph.email_id AND es.lead_id = ph.lead_id
WHERE es.email_id IN (${emailIds.join(',')})
  AND (DATE(es.date_sent) = @reportDate
    OR DATE(es.date_read) = @reportDate
    OR DATE(ph.date_hit) = @reportDate
    )
GROUP BY es.lead_id, es.date_sent, es.date_read, ph.date_hit, es.email_id

UNION ALL

SELECT @reportDate reportDate,
       '${name}' periodOfTime,
       es.email_id,
       es.lead_id,
       es.date_sent,
       null isSend,
       es.date_read,
       NULL isClicked,
       ph.date_hit clickDate,
       IF(DATE(ph.date_hit)=@reportDate, 'read', null) isRead
FROM page_hits ph
         INNER JOIN email_stats es on ph.email_id = es.email_id AND ph.lead_id = es.lead_id
WHERE DATE(ph.date_hit) = @reportDate
  AND ph.email_id IN (${emailIds.join(',')})
  `;

  return inputs.map(input => sql(input)).join("\nUNION ALL\n");
}

const unsubscribeEmails = ({ inputs }) => {
  const sql = ({name, emailIds, pageIds}) => `
SELECT @reportDate reportDate,
       '${name}' periodOfTime,
       ph.email_id,
       ph.lead_id,
       MAX(ph.date_hit) pageDateHit
FROM page_hits ph
WHERE ph.email_id IN (${emailIds.join(',')})
  AND  DATE(ph.date_hit) = @reportDate
  AND ph.redirect_id IN (${pageIds.join(',')})
GROUP BY ph.lead_id, ph.email_id
`;

  return inputs.map(input => sql(input)).join("\nUNION ALL\n");
}

const messages = ({inputs}) => {
  const sql = ({name, messageIds, pageIds}) => `
  SELECT
    @reportDate reportDate,
    '${name}' periodOfTime,
    ph.lead_id leadId,
    vms.message_id messageId,
    vm.name messageTitle,
    MAX(vms.date_sent) sendDate,
    null isSend,
    MAX(ph.date_hit) pageHitDate,
    IF(DATE(MAX(ph.date_hit))=@reportDate, 'clicked', null) isClicked,
    ph.page_id pageId
FROM page_hits ph
         LEFT JOIN (
    SELECT DISTINCT lead_id, message_id, MAX(date_sent) date_sent
    FROM vonage_message_stats _vms
    WHERE _vms.message_id IN (${messageIds.join(',')})
    GROUP BY _vms.lead_id, _vms.message_id
) vms on ph.lead_id = vms.lead_id
         LEFT JOIN vonage_messages vm ON vm.id = vms.message_id
WHERE ph.page_id IN (${pageIds.join(',')})
  AND (DATE(ph.date_hit) = @reportDate)
GROUP BY leadId, messageId, vm.name, ph.page_id
UNION
SELECT @reportDate reportDate,
       '${name}' periodOfTime,
       vms.lead_id leadId,
       vm.id messageId,
       vm.name messageTitle,
       vms.date_sent sendDate,
       IF(DATE(vms.date_sent)=@reportDate, 'send', null) isSend,
       ph.date_hit pageHitDate,
       null isClicked,
       ph.page_id pageId
FROM vonage_message_stats vms
         LEFT JOIN vonage_messages vm ON vm.id = vms.message_id
         LEFT JOIN (
    SELECT DISTINCT lead_id, MAX(date_hit) date_hit, MAX(page_id) page_id
    FROM page_hits
    WHERE page_id IN (${pageIds.join(',')})
    GROUP BY lead_id
) ph ON ph.lead_id = vms.lead_id
WHERE (DATE(vms.date_sent) = @reportDate OR DATE(ph.date_hit) = @reportDate)
  AND vm.id IN (${messageIds.join(',')})
  `;

  return inputs.map(input => sql(input)).join("\nUNION ALL\n");
}

const unsubscribeMessages = ({ inputs }) => {
  const sql = ({name, messageIds, pageIds}) => `
  SELECT
    @reportDate reportDate,
    '${name}' periodOfTime,
    ph.lead_id leadId,
    vms.message_id messageId,
    vm.name messageTitle,
    MAX(ph.date_hit) pageHitDate,
    ph.page_id pageId
FROM page_hits ph
    LEFT JOIN vonage_message_stats vms on ph.lead_id = vms.lead_id
    LEFT JOIN vonage_messages vm ON vm.id = vms.message_id
WHERE ph.page_id IN (${pageIds.join(',')})
  AND vms.message_id IN (${messageIds.join(',')})
  AND (DATE(ph.date_hit) = @reportDate)
GROUP BY leadId, messageId, vm.name, ph.page_id`;

  return inputs.map(input => sql(input)).join("\nUNION ALL\n");
}

const removal = ({segmentIds}) => `
SELECT @reportDate reportDate,
       lead_id,
       date_added,
       action
FROM lead_event_log
WHERE DATE(date_added)=@reportDate
  AND object='segment'
  AND object_id IN (${segmentIds.join(',')})
`



const fieldChanges = ({ fieldAliases }) => {
  const details = fieldAliases.map(field => `details LIKE '%${field}%'`).join(' OR ',)
  return `
SELECT @reportDate reportDate,
       details,
       object_id leadId,
       date_added dateAdded
FROM audit_log
WHERE bundle='lead'
  AND object='lead'
  AND action='update'
  AND DATE(date_added)=@reportDate
  AND (${details})`;
}

module.exports = {
  setReportDate,
  totalPotentials,
  purchasesAndRejections,
  messages,
  unsubscribeMessages,
  emails,
  unsubscribeEmails,
  removal,
  fieldChanges
};
