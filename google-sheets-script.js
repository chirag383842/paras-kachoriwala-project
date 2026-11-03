/**
 * Google Apps Script for Paras Kachoriwala Customer Feedback Sync & Deduplication
 * 
 * Instructions:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/
 * 2. In the top menu, click: Extensions > Apps Script
 * 3. Delete everything in the editor and PASTE this entire code.
 * 4. Click "Save" (disk icon).
 * 
 * TO REMOVE ALREADY EXISTING DUPLICATE ROWS FROM YOUR SHEET:
 * 5. At the top of Apps Script, in the function dropdown (next to "Debug" / "Run"),
 *    select "cleanupExistingDuplicates".
 * 6. Click "Run". It will scan your sheet and delete all repeated rows,
 *    leaving only 1 single copy of each review!
 * 
 * TO DEPLOY / UPDATE THE LIVE WEBHOOK:
 * 7. Click "Deploy" (blue button at top right) > "Manage deployments".
 * 8. Click the Pencil (Edit) icon next to your active deployment.
 * 9. In the "Version" dropdown, select "New version".
 * 10. Click "Deploy".
 */

function getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Check for tab named "Feedback"
  var sheet = ss.getSheetByName("Feedback");
  if (sheet) return sheet;

  // 2. Check for tab named "Sheet1" or "Sheet 1"
  sheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Sheet 1");
  if (sheet) return sheet;

  // 3. Check active sheet
  sheet = ss.getActiveSheet();
  if (sheet) return sheet;

  // 4. Create "Feedback" tab if none exist
  return ss.insertSheet("Feedback");
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Timestamp",
      "Record ID",
      "Customer Name",
      "Overall Rating",
      "Food Rating",
      "Service Rating",
      "Cleanliness Rating",
      "Feedback Message"
    ]);
    var headerRange = sheet.getRange(1, 1, 1, 8);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#9c4c18");
    headerRange.setFontColor("#ffffff");
  }
}

function parsePayload(e) {
  var data = {};
  if (!e) return data;

  if (e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      if (typeof e.postData.contents === 'string') {
        var pairs = e.postData.contents.split('&');
        pairs.forEach(function(pair) {
          var kv = pair.split('=');
          if (kv.length === 2) {
            data[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1].replace(/\+/g, ' '));
          }
        });
      }
    }
  }

  if (Object.keys(data).length === 0 && e.parameter) {
    data = e.parameter;
  }

  return data;
}

function recordFeedback(data) {
  var lock = LockService.getScriptLock();
  try {
    // Wait up to 25 seconds for concurrent executions to finish
    lock.waitLock(25000);
  } catch (e) {
    // Continue with best effort
  }

  try {
    var sheet = getTargetSheet();
    ensureHeaders(sheet);

    var timestamp = data.timestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    var customerName = String(data.customer_name || data.customerName || "Anonymous Customer").trim();
    var overallRating = Number(data.overall_rating || data.overallRating || 5);
    var foodRating = Number(data.food_rating || data.foodRating || 0);
    var serviceRating = Number(data.service_rating || data.serviceRating || 0);
    var cleanlinessRating = Number(data.cleanliness_rating || data.cleanlinessRating || 0);
    var message = String(data.message || data.feedback || "").trim();
    var recordId = String(data.record_id || data.recordId || "").trim();

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    // Check header row to detect 7-column or 8-column structure
    var hasRecordIdCol = false;
    if (lastRow > 0 && lastCol > 1) {
      var headerValues = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
      if (headerValues[1] && headerValues[1].toLowerCase().indexOf("record") !== -1) {
        hasRecordIdCol = true;
      }
    }

    // Strict deduplication: check existing rows (last 100 rows)
    if (lastRow > 1) {
      var startRow = Math.max(2, lastRow - 99);
      var numRows = lastRow - startRow + 1;
      var existingData = sheet.getRange(startRow, 1, numRows, lastCol).getDisplayValues();

      for (var i = 0; i < existingData.length; i++) {
        var row = existingData[i];
        var rowCustomerName = "";
        var rowOverallRating = "";
        var rowMessage = "";
        var rowRecordId = "";

        if (hasRecordIdCol) {
          rowRecordId = String(row[1] || "").trim();
          rowCustomerName = String(row[2] || "").trim();
          rowOverallRating = String(row[3] || "").trim();
          rowMessage = String(row[7] || "").trim();
        } else {
          rowCustomerName = String(row[1] || "").trim();
          rowOverallRating = String(row[2] || "").trim();
          rowMessage = String(row[6] || "").trim();
        }

        // Duplicate condition 1: Exact matching non-empty Record ID
        if (recordId && rowRecordId && recordId === rowRecordId) {
          return {
            status: "duplicate",
            message: "Duplicate review skipped by Record ID",
            sheet: sheet.getName()
          };
        }

        // Duplicate condition 2: Immediate duplicate entry (same name & message received within seconds)
        // This prevents network double-dispatch / rapid double-clicks on the SAME entry,
        // while allowing a new entry after waiting for the second data.
        if (
          customerName.toLowerCase() === rowCustomerName.toLowerCase() &&
          message.toLowerCase() === rowMessage.toLowerCase() &&
          message.length > 0
        ) {
          var rowTimestamp = String(row[0] || "").trim();
          var isImmediateDuplicate = false;

          if (rowTimestamp && timestamp && rowTimestamp === timestamp) {
            isImmediateDuplicate = true;
          } else if (i === existingData.length - 1) {
            // Immediately previous row: check time delta if parseable
            var prevTime = new Date(rowTimestamp).getTime();
            var currTime = new Date(timestamp).getTime();
            if (!isNaN(prevTime) && !isNaN(currTime) && Math.abs(currTime - prevTime) < 15000) {
              isImmediateDuplicate = true;
            }
          }

          if (isImmediateDuplicate) {
            return {
              status: "duplicate",
              message: "Duplicate review skipped (rapid repeated entry)",
              sheet: sheet.getName()
            };
          }
        }
      }
    }

    // Append new unique row
    if (hasRecordIdCol) {
      sheet.appendRow([
        timestamp,
        recordId,
        customerName,
        overallRating,
        foodRating,
        serviceRating,
        cleanlinessRating,
        message
      ]);
    } else {
      sheet.appendRow([
        timestamp,
        customerName,
        overallRating,
        foodRating,
        serviceRating,
        cleanlinessRating,
        message
      ]);
    }

    return {
      status: "success",
      message: "New feedback recorded successfully",
      sheet: sheet.getName(),
      timestamp: timestamp
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function getAppStateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("AppState");
  if (sheet) return sheet;
  sheet = ss.insertSheet("AppState");
  sheet.appendRow(["Key", "Value", "Updated_At"]);
  var headerRange = sheet.getRange(1, 1, 1, 3);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#9c4c18");
  headerRange.setFontColor("#ffffff");
  return sheet;
}

function getAppState() {
  try {
    var sheet = getAppStateSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return {};
    var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    var state = {};
    for (var i = 0; i < data.length; i++) {
      var key = String(data[i][0] || "").trim();
      var val = data[i][1];
      if (key) {
        try {
          state[key] = JSON.parse(val);
        } catch (e) {
          state[key] = val;
        }
      }
    }
    return state;
  } catch (err) {
    return {};
  }
}

function saveAppStateKey(key, value) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {}

  try {
    var sheet = getAppStateSheet();
    var lastRow = sheet.getLastRow();
    var valStr = typeof value === 'string' ? value : JSON.stringify(value);
    var now = new Date().toISOString();

    if (lastRow > 1) {
      var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < data.length; i++) {
        if (String(data[i][0] || "").trim() === key) {
          var rowIndex = i + 2;
          sheet.getRange(rowIndex, 2).setValue(valStr);
          sheet.getRange(rowIndex, 3).setValue(now);
          return { status: "success", key: key, updated_at: now };
        }
      }
    }

    sheet.appendRow([key, valStr, now]);
    return { status: "success", key: key, updated_at: now };
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function doPost(e) {
  try {
    var data = parsePayload(e);

    // 1. Support saving application state across devices
    if (data.action === 'saveState') {
      if (data.key && data.value !== undefined) {
        var res = saveAppStateKey(data.key, data.value);
        return ContentService.createTextOutput(JSON.stringify(res))
          .setMimeType(ContentService.MimeType.JSON);
      }
      if (data.state && typeof data.state === 'object') {
        for (var k in data.state) {
          saveAppStateKey(k, data.state[k]);
        }
        return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 2. Default: record customer feedback
    var result = recordFeedback(data);

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  if (e && e.parameter) {
    // 1. Get Application State (for real-time multi-device sync)
    if (e.parameter.action === 'getState' || e.parameter.action === 'state') {
      try {
        var state = getAppState();
        return ContentService.createTextOutput(JSON.stringify({ status: "success", data: state }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 2. Save Application State via GET (avoids CORS preflight)
    if (e.parameter.action === 'saveState' && e.parameter.key) {
      try {
        var key = e.parameter.key;
        var value = e.parameter.value;
        try {
          value = JSON.parse(value);
        } catch (ex) {}
        var saveResult = saveAppStateKey(key, value);
        return ContentService.createTextOutput(JSON.stringify(saveResult))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 3. Read Customer Feedback
    if (e.parameter.action === 'getFeedback' || e.parameter.action === 'read' || e.parameter.action === 'list') {
      try {
        var sheet = getTargetSheet();
        var lastRow = sheet.getLastRow();
        var lastCol = sheet.getLastColumn();
        if (lastRow <= 1) {
          return ContentService.createTextOutput(JSON.stringify({ status: "success", data: [] }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
        var headerValues = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
        var hasRecordId = false;
        if (headerValues[1] && headerValues[1].toLowerCase().indexOf("record") !== -1) {
          hasRecordId = true;
        }
        var list = [];
        for (var i = 0; i < data.length; i++) {
          var row = data[i];
          var timestamp = String(row[0] || "").trim();
          var recordId = hasRecordId ? String(row[1] || "").trim() : "";
          var customerName = hasRecordId ? String(row[2] || "").trim() : String(row[1] || "").trim();
          var overallRating = Number(hasRecordId ? row[3] : row[2]) || 5;
          var foodRating = Number(hasRecordId ? row[4] : row[3]) || 0;
          var serviceRating = Number(hasRecordId ? row[5] : row[4]) || 0;
          var cleanlinessRating = Number(hasRecordId ? row[6] : row[5]) || 0;
          var message = hasRecordId ? String(row[7] || "").trim() : String(row[6] || "").trim();

          if (message || customerName) {
            list.push({
              id: recordId || ('sheet_' + (i + 1)),
              customer_name: customerName || 'Anonymous Customer',
              overall_rating: overallRating,
              food_rating: foodRating || null,
              service_rating: serviceRating || null,
              cleanliness_rating: cleanlinessRating || null,
              message: message,
              timestamp: timestamp,
              created_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
              approved: false
            });
          }
        }
        return ContentService.createTextOutput(JSON.stringify({ status: "success", data: list }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (e.parameter.action === 'cleanupExistingDuplicates') {
      var summary = cleanupExistingDuplicates();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: summary }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (e.parameter.overall_rating || e.parameter.message) {
      try {
        var result = recordFeedback(e.parameter);
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Paras Kachoriwala Google Sheets Webhook is active and deduplicated!"
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * UTILITY: Run this once from Apps Script editor to remove all existing duplicates
 * in your sheet (e.g. repeated 'my name', 'nbahida aap batho' rows),
 * keeping exactly 1 unique row per review.
 */
function cleanupExistingDuplicates() {
  var sheet = getTargetSheet();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow <= 2) {
    Logger.log("Not enough rows to clean.");
    return "Not enough rows to clean.";
  }

  var headerValues = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var hasRecordIdCol = false;
  if (headerValues[1] && headerValues[1].toLowerCase().indexOf("record") !== -1) {
    hasRecordIdCol = true;
  }

  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  var seenKeys = {};
  var rowsToDelete = [];

  // Iterate from top to bottom
  for (var i = 0; i < allData.length; i++) {
    var row = allData[i];
    var actualRowIndex = i + 2; // Row in sheet (1-based, skipping header)

    var name = hasRecordIdCol ? row[2] : row[1];
    var msg = hasRecordIdCol ? row[7] : row[6];
    var rating = hasRecordIdCol ? row[3] : row[2];

    var key = (name + "|||" + rating + "|||" + msg).toLowerCase().trim();

    if (seenKeys[key]) {
      // Duplicate row found
      rowsToDelete.push(actualRowIndex);
    } else {
      seenKeys[key] = true;
    }
  }

  // Delete duplicate rows from bottom to top so row indices don't shift
  for (var j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }

  var summary = "Cleanup Finished: Successfully removed " + rowsToDelete.length + " duplicate row(s)!";
  Logger.log(summary);
  return summary;
}
