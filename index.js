const express = require('express');
const cors = require('cors');
const { Sequelize, Op } = require('sequelize');
const ExcelJS = require('exceljs');
const CallData = require('./CallData');
const app = express();
const port = 7000;
app.use(cors())
app.use(express.json());

const sequelize = new Sequelize('dalycdr', 'root', 'root', {
  host: 'localhost',
  dialect: 'mysql',
  pool: {
    max: 10, // Maximum number of connections in the pool
    min: 0,  // Minimum number of connections in the pool
    acquire: 600000, // Maximum time (in milliseconds) that a connection can be acquired
    idle: 600000    // Maximum time (in milliseconds) that a connection can be idle
  },
});
sequelize
  .authenticate()
  .then(() => {
    console.log('Connection to the database has been established successfully.');
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
  });


// app.get('/api/call-data', async (req, res) => {
//   try {
//     const callData = await CallData.findAll({
//       attributes: ['userFullName', 'date', 'time', 'campaign', 'talkDuration', 'callType', 'callStatus'],
//     });
//     res.json(callData);
//   } catch (error) {
//     console.error('Error retrieving data:', error);
//     res.status(500).json({ error: 'An error occurred while retrieving data.' });
//   }
// });


app.get('/', (req, res) => {
  res.json('hello mahesh, how are you...')
})

app.get('/api/unique-dates', async (req, res) => {
  try {
    // Fetch all unique dates from the CallData model
    const uniqueDates = await CallData.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('date')), 'date']
      ],
    });

    // Extract the date values from the result
    const dateValues = uniqueDates.map((date) => date.get('date'));

    res.json(dateValues);
  } catch (error) {
    console.error('Error retrieving unique dates:', error);
    res.status(500).json({ error: 'An error occurred while retrieving data.' });
  }
});

app.get('/api/all/call-data', async (req, res) => {
  try {
    const callData = await CallData.findAll({
      attributes: ['userFullName', 'date', 'campaign', 'callStatus', 'talkDuration'],
    });
    res.json(callData);
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).json({ error: 'An error occurred while retrieving data.' });
  }
});

// sum of connected dis calls & avg of connected calls

app.get('/api/sum-users', async (req, res) => {
  try {
    // Get the optional date parameter from the request
    const selectedDate = req.query.date || null;
    const selectedName = req.query.userFullName || null;

    // Fetch the data grouped by userFullName
    const callData = await CallData.findAll({
      attributes: ['userFullName', 'callStatus', 'talkDuration'],
      where: selectedDate ? { Date: selectedDate } : {},
      where: selectedName ? {userFullName: selectedName}: {}
    });

    const groupedData = {};

    for (const item of callData) {
      const user = item.userFullName;
      const callStatus = item.callStatus;

      if (!groupedData[user]) {
        groupedData[user] = {
          userFullName: user,
          callStatusCounts: {
            CONNECTED: 0,
            DISCONNECTED: 0,
          },
          talkDurationSum: '0:00:00', // Initialize as '0:00:00'
        };
      }

      // Update the callStatus count for the user based on the callStatus
      if (callStatus === 'CONNECTED' || callStatus === 'DISCONNECTED') {
        groupedData[user].callStatusCounts[callStatus] += 1;
      }

      // Only update data if the callStatus is CONNECTED
      if (callStatus === 'CONNECTED') {
        groupedData[user].talkDurationSum = addTime(groupedData[user].talkDurationSum, item.talkDuration);
      }
    }

    // Calculate the average talkDuration for CONNECTED calls only
    for (const user in groupedData) {
      if (groupedData[user].callStatusCounts.CONNECTED > 0) {
        const totalTalkDuration = groupedData[user].talkDurationSum;
        const totalCallCount = groupedData[user].callStatusCounts.CONNECTED;
        const avgTalkDuration = divideTime(totalTalkDuration, totalCallCount);
        groupedData[user].talkDurationAvg = avgTalkDuration;
      } else {
        groupedData[user].talkDurationAvg = '0:00:00'; // Handle cases where there are no CONNECTED calls
      }
    }

    res.json(Object.values(groupedData));
  } catch (error) {
    console.error('Error retrieving and processing data:', error);
    res.status(500).json({ error: 'An error occurred while retrieving and processing data.' });
  }
});

app.get('/api/sum-totals-by-callstatus', async (req, res) => {
  try {
    // Get the optional date parameter from the request
    const selectedDate = req.query.date || null;
    // Fetch the data grouped by callStatus
    const callData = await CallData.findAll({
      attributes: ['callStatus', 'talkDuration'],
      where: selectedDate ? { Date: selectedDate } : {},
    });

    const groupedData = {};

    for (const item of callData) {
      const callStatus = item.callStatus;

      if (!groupedData[callStatus]) {
        groupedData[callStatus] = {
          callStatus: callStatus || "",
          callStatusCount: 0,
          talkDurationSum: '0:00:00', // Initialize as '0:00:00'
        };
      }

      // Update the callStatus count and convert the talkDuration to seconds for sum
      groupedData[callStatus].callStatusCount += 1;
      groupedData[callStatus].talkDurationSum = addTime(groupedData[callStatus].talkDurationSum, item.talkDuration);
    }

    // Calculate the average talkDuration for each callStatus
    for (const callStatus in groupedData) {
      if (groupedData[callStatus].callStatusCount > 0) {
        const totalTalkDuration = groupedData[callStatus].talkDurationSum;
        const divisor = groupedData[callStatus].callStatusCount;
        const avgTalkDuration = divideTime(totalTalkDuration, divisor);
        groupedData[callStatus].talkDurationAvg = avgTalkDuration;
      } else {
        groupedData[callStatus].talkDurationAvg = '0:00:00'; // Handle cases where callStatusCount is 0
      }
    }

    res.json(Object.values(groupedData));
  } catch (error) {
    console.error('Error retrieving and processing data:', error);
    res.status(500).json({ error: 'An error occurred while retrieving and processing data.' });
  }
});

app.get('/api/sum-users-connectedcalls', async (req, res) => {
  try {
    // Get the optional date parameter from the request
    const selectedDate = req.query.date || null;
    // Fetch the data grouped by userFullName
    const callData = await CallData.findAll({
      attributes: ['userFullName', 'callStatus', 'talkDuration'],
      where: selectedDate ? { Date: selectedDate } : {},
    });

    const groupedData = {};

    for (const item of callData) {
      const user = item.userFullName;
      const callStatus = item.callStatus;

      if (!groupedData[user]) {
        groupedData[user] = {
          userFullName: user,
          callStatusCounts: {}, // Initialize an object to store callStatus counts
          talkDurationSum: '0:00:00', // Initialize as '0:00:00'
        };
      }

      // Only update data if the callStatus is CONNECTED
      if (callStatus === 'CONNECTED') {
        // Initialize callStatus count for CONNECTED calls
        if (!groupedData[user].callStatusCounts.CONNECTED) {
          groupedData[user].callStatusCounts.CONNECTED = 0;
        }

        // Update the callStatus count for the user and convert the talkDuration to seconds for sum
        groupedData[user].callStatusCounts.CONNECTED += 1;
        groupedData[user].talkDurationSum = addTime(groupedData[user].talkDurationSum, item.talkDuration);
      }
    }

    // Calculate the average talkDuration for CONNECTED calls only
    for (const user in groupedData) {
      if (groupedData[user].callStatusCounts.CONNECTED > 0) {
        const totalTalkDuration = groupedData[user].talkDurationSum;
        const totalCallCount = groupedData[user].callStatusCounts.CONNECTED;
        const avgTalkDuration = divideTime(totalTalkDuration, totalCallCount);
        groupedData[user].talkDurationAvg = avgTalkDuration;
      } else {
        groupedData[user].talkDurationAvg = '0:00:00'; // Handle cases where there are no CONNECTED calls
      }
    }

    res.json(Object.values(groupedData));
  } catch (error) {
    console.error('Error retrieving and processing data:', error);
    res.status(500).json({ error: 'An error occurred while retrieving and processing data.' });
  }
});

app.get('/api/sum-totals-by-user', async (req, res) => {
  try {
    // Get the optional date parameter from the request
    const selectedDate = req.query.date || null;

    // Fetch the data grouped by userFullName and filtered by the selected date
    const callData = await CallData.findAll({
      attributes: ['userFullName', 'callStatus', 'talkDuration'],
      where: selectedDate ? { Date: selectedDate } : {},
    });

    const groupedData = {};

    for (const item of callData) {
      const user = item.userFullName;
      const callStatus = item.callStatus;

      if (!groupedData[user]) {
        groupedData[user] = {
          userFullName: user,
          callStatusCounts: {
            CONNECTED: 0,
            DISCONNECTED: 0,
          },
          talkDurationSum: '0:00:00', // Initialize as '0:00:00'
        };
      }

      // Update the callStatus count for the user based on the callStatus
      if (callStatus === 'CONNECTED' || callStatus === 'DISCONNECTED') {
        groupedData[user].callStatusCounts[callStatus] += 1;
      }

      // Only update data if the callStatus is CONNECTED
      if (callStatus === 'CONNECTED') {
        groupedData[user].talkDurationSum = addTime(groupedData[user].talkDurationSum, item.talkDuration);
      }
    }

    // Calculate the average talkDuration for CONNECTED calls only
    for (const user in groupedData) {
      if (groupedData[user].callStatusCounts.CONNECTED > 0) {
        const totalTalkDuration = groupedData[user].talkDurationSum;
        const totalCallCount = groupedData[user].callStatusCounts.CONNECTED;
        const avgTalkDuration = divideTime(totalTalkDuration, totalCallCount);
        groupedData[user].talkDurationAvg = avgTalkDuration;
      } else {
        groupedData[user].talkDurationAvg = '0:00:00'; // Handle cases where there are no CONNECTED calls
      }
    }

    res.json(Object.values(groupedData));
  } catch (error) {
    console.error('Error retrieving and processing data:', error);
    res.status(500).json({ error: 'An error occurred while retrieving and processing data.' });
  }
});

app.get('/api/sum-totals-by-campaign', async (req, res) => {
  try {
    // Get the optional date parameter from the request
    const selectedDate = req.query.date || null;

    // Fetch the data grouped by campaign and filtered by the selected date
    const callData = await CallData.findAll({
      attributes: ['campaign', 'callStatus', 'talkDuration'],
      where: selectedDate ? { Date: selectedDate } : {},
    });

    const groupedData = {};

    for (const item of callData) {
      const campaign = item.campaign;
      const callStatus = item.callStatus;

      if (!groupedData[campaign]) {
        groupedData[campaign] = {
          campaign,
          callStatusCounts: {
            CONNECTED: 0,
            DISCONNECTED: 0,
          },
          talkDurationSum: '0:00:00', // Initialize as '0:00:00'
        };
      }

      // Update the callStatus count for the campaign based on the callStatus
      if (callStatus === 'CONNECTED' || callStatus === 'DISCONNECTED') {
        groupedData[campaign].callStatusCounts[callStatus] += 1;
      }

      // Only update data if the callStatus is CONNECTED
      if (callStatus === 'CONNECTED') {
        groupedData[campaign].talkDurationSum = addTime(groupedData[campaign].talkDurationSum, item.talkDuration);
      }
    }

    // Calculate the average talkDuration for CONNECTED calls only
    for (const campaign in groupedData) {
      if (groupedData[campaign].callStatusCounts.CONNECTED > 0) {
        const totalTalkDuration = groupedData[campaign].talkDurationSum;
        const totalCallCount = groupedData[campaign].callStatusCounts.CONNECTED;
        const avgTalkDuration = divideTime(totalTalkDuration, totalCallCount);
        groupedData[campaign].talkDurationAvg = avgTalkDuration;
      } else {
        groupedData[campaign].talkDurationAvg = '0:00:00'; // Handle cases where there are no CONNECTED calls
      }
    }

    res.json(Object.values(groupedData));
  } catch (error) {
    console.error('Error retrieving and processing data:', error);
    res.status(500).json({ error: 'An error occurred while retrieving and processing data.' });
  }
});

app.get('/api/sum-campaign-count-by-callType', async (req, res) => {
  try {
    // Get the optional date parameter from the request
    const selectedDate = req.query.date || null;

    // Fetch the data grouped by callType and filtered by the selected date
    const callData = await CallData.findAll({
      attributes: ['callType', 'campaign'],
      where: selectedDate ? { Date: selectedDate } : {},
    });

    const groupedData = {};

    for (const item of callData) {
      const callType = item.callType;
      const campaign = item.campaign;

      if (!groupedData[callType]) {
        groupedData[callType] = {
          callType,
          campaignCount: 0,
        };
      }

      if (!groupedData[callType][campaign]) {
        groupedData[callType][campaign] = 1;
      } else {
        groupedData[callType][campaign]++;
      }

      // Count the number of unique campaigns for each callType
      if (!groupedData[callType].campaignCount) {
        groupedData[callType].campaignCount = 1;
      } else {
        groupedData[callType].campaignCount++;
      }
    }

    res.json(Object.values(groupedData));
  } catch (error) {
    console.error('Error retrieving and processing data:', error);
    res.status(500).json({ error: 'An error occurred while retrieving and processing data.' });
  }
});



// app.get('/api/sum-totals-by-callType', async (req, res) => {
//   try {
//     // Get the optional date parameter from the request
//     const selectedDate = req.query.date || null;

//     // Fetch the data grouped by callType and filtered by the selected date
//     const callData = await CallData.findAll({
//       attributes: ['callType', 'callStatus', 'talkDuration'],
//       where: selectedDate ? { Date: selectedDate } : {},
//     });

//     const groupedData = {};

//     for (const item of callData) {
//       const callType = item.callType;
//       const callStatus = item.callStatus;

//       if (!groupedData[callType]) {
//         groupedData[callType] = {
//           callType,
//           callStatusCounts: {
//             CONNECTED: 0,
//             DISCONNECTED: 0,
//           },
//           talkDurationSum: '0:00:00', // Initialize as '0:00:00'
//         };
//       }

//       // Update the callStatus count for the callType based on the callStatus
//       if (callStatus === 'CONNECTED' || callStatus === 'DISCONNECTED') {
//         groupedData[callType].callStatusCounts[callStatus] += 1;
//       }

//       // Only update data if the callStatus is CONNECTED
//       if (callStatus === 'CONNECTED') {
//         groupedData[callType].talkDurationSum = addTime(groupedData[callType].talkDurationSum, item.talkDuration);
//       }
//     }

//     // Calculate the average talkDuration for CONNECTED calls only
//     for (const callType in groupedData) {
//       if (groupedData[callType].callStatusCounts.CONNECTED > 0) {
//         const totalTalkDuration = groupedData[callType].talkDurationSum;
//         const totalCallCount = groupedData[callType].callStatusCounts.CONNECTED;
//         const avgTalkDuration = divideTime(totalTalkDuration, totalCallCount);
//         groupedData[callType].talkDurationAvg = avgTalkDuration;
//       } else {
//         groupedData[callType].talkDurationAvg = '0:00:00'; // Handle cases where there are no CONNECTED calls
//       }
//     }

//     res.json(Object.values(groupedData));
//   } catch (error) {
//     console.error('Error retrieving and processing data:', error);
//     res.status(500).json({ error: 'An error occurred while retrieving and processing data.' });
//   }
// });


function addTime(time1, time2) {
  const [hours1, minutes1, seconds1] = time1.split(':').map(Number);
  const [hours2, minutes2, seconds2] = time2.split(':').map(Number);

  let carry = 0;
  const seconds = seconds1 + seconds2;
  carry = Math.floor(seconds / 60);
  const minutes = minutes1 + minutes2 + carry;
  carry = Math.floor(minutes / 60);
  const hours = hours1 + hours2 + carry;

  const format = (value) => value.toString().padStart(2, '0');

  return `${format(hours)}:${format(minutes % 60)}:${format(seconds % 60)}`;
}

function divideTime(time, divisor) {
  const [hours, minutes, seconds] = time.split(':').map(Number);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const averageSeconds = totalSeconds / divisor;

  const avgHours = Math.floor(averageSeconds / 3600);
  const avgMinutes = Math.floor((averageSeconds % 3600) / 60);
  const avgSeconds = Math.floor(averageSeconds % 60);

  const format = (value) => value.toString().padStart(2, '0');

  return `${format(avgHours)}:${format(avgMinutes)}:${format(avgSeconds)}`;
}

// const tableName = 'mitcdrdely';
// const workbook = new ExcelJS.Workbook();

// const excelFilePath = 'mitcdr.xlsx';

// workbook.xlsx.readFile(excelFilePath)
//     .then(() => {
//         const worksheet = workbook.getWorksheet(1);
//         worksheet.eachRow((row, rowNumber) => {
//             if (rowNumber === 1) {
//                 return;
//             }

//             const userFullName = row.getCell(1).value;
//             const date = row.getCell(2).value;
//             const campaign = row.getCell(3).value;
//             const talkDuration = row.getCell(4).value;
//             const callType = row.getCell(5).value;
//             const callStatus = row.getCell(6).value;

//             const sql = `INSERT INTO ${tableName} (UserFullName, Date, Campaign, TalkDuration, CallType, CallStatus) VALUES (?, ?, ?, ?, ?, ?)`;
//             const values = [userFullName, date, campaign, talkDuration, callType, callStatus];

//             sequelize.query(sql, { replacements: values, type: sequelize.QueryTypes.INSERT })
//                 .then(() => {
//                     console.log(`Inserted row ${rowNumber - 1}`);
//                 })
//                 .catch((err) => {
//                     console.error(`Error inserting data into MySQL: ${err}`);
//                 });
//         });
//     })
//     .catch((error) => {
//         console.error(`Error reading Excel file: ${error}`);
//     })
//     .finally(() => {
//         sequelize.close();
//     });


app.listen(port, () => {
  console.log(`server listen on port ${port}`)
})