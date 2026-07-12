"use strict";
const config = require('./config');

// Update for Cult Sport activities
const ActivityType = {
    "badminton": {
        "id": 2,
        "name": "BADMINTON",
        "displayText": "BADMINTON",
        "preference": 1,
        "workoutId": 350
    },
    "swimming": {
        "id": 4,
        "name": "SWIMMING",
        "displayText": "SWIMMING",
        "preference": 2,
        "workoutId": 351
    },
    "table_tennis": {
        "id": 6,
        "name": "TABLE_TENNIS",
        "displayText": "TABLE TENNIS",
        "preference": 3,
        "workoutId": 352
    },
    "squash": {
        "id": 7,
        "name": "SQUASH",
        "displayText": "SQUASH",
        "preference": 4,
        "workoutId": 353
    }
};

const commonHeaders = {
    "accept": "application/json",
    "apikey": config.apiKey,
    "appversion": config.appVersion,
    "browsername": config.browserName,
    "osname": config.osName,
    "timezone": config.timezone,
    "content-type": "application/json",
    "Cookie": config.cookies
};

const CURE_FIT_HOST = "www.cult.fit";
const URI = {
    "GET_SCHEDULE": "/api/v2/fitso/schedule", // Updated endpoint for schedule
    "BOOK_CLASS": "/api/v2/fitso/class/book" // Updated booking endpoint
};

const HTTP_POST = "POST",
    HTTP_GET = "GET";

const PREFERRED_SLOTS = config.preferredSlots || ['09:00:00'];
const PREFERRED_CENTER = config.preferredCenter || 1515;
const PREFERRED_SPORT_NAME = config.preferredSport || "BADMINTON"; // Changed config key
const ENABLE_WAITLIST = config.enableWaitlist !== false;

const PREFERRED_SPORTS_IN_ORDER = Object.values(ActivityType).filter(
    activity => activity.name === PREFERRED_SPORT_NAME
);

async function main() {
    try {
        // Fetch schedule data from new API
        const scheduleResponse = await makeAPICall({}, CURE_FIT_HOST, URI.GET_SCHEDULE, HTTP_GET, commonHeaders);
        const lastDateKey = Object.keys(scheduleResponse.classByDateMap).sort().slice(-1)[0];
        const classesForDay = scheduleResponse.classByDateMap[lastDateKey];
        const dateStr = lastDateKey;

        console.log(`Booking for ${dateStr}`);

        if (hasBookingForDate(classesForDay)) {
            console.log(`Already booked on ${dateStr}. Skipping.`);
            return;
        }

        let slots = [];

        for (let slot of PREFERRED_SLOTS) {
            slots = getSlots(classesForDay, slot, PREFERRED_SPORTS_IN_ORDER);

            if (slots.length > 0) {
                const sportInfo = slots[0];
                console.log(`Found ${PREFERRED_SPORT_NAME} at ${slot} on ${dateStr}`);

                if (sportInfo.state === 'WAITLIST_AVAILABLE') {
                    const waitlistCount = sportInfo.waitlistInfo ? sportInfo.waitlistInfo.waitlistedUserCount : 0;
                    console.log(`Joining waitlist (${waitlistCount} people ahead)`);
                } else {
                    console.log(`Booking (${sportInfo.availableSeats} seats available)`);
                }

                await bookSport(sportInfo.id, dateStr);
                console.log("Sport slot booked successfully!");
                break;
            }
        }

        if (slots.length === 0) {
            console.log(`No ${PREFERRED_SPORT_NAME} slots available on ${dateStr}`);
        }
    } catch (error) {
        errorHandler(error);
    }
}

main();

async function bookSport(slotID, dateStr) {
    // Generate a proper booking timestamp
    const bookingTimestamp = getBookingTimestamp(dateStr, slotID);
    const requestBody = {
        "slotId": slotID,
        "bookingTimestamp": bookingTimestamp,
        "centerId": PREFERRED_CENTER,
        "workoutId": getWorkoutIdBySlotId(slotID),
        "productArenaCategoryId": PRODUCT_ARENA_CATEGORY_ID,
        "params": null
    };
    try {
        const response = await makeAPICall(requestBody, CURE_FIT_HOST, URI.BOOK_CLASS, HTTP_POST, commonHeaders);
        return response;
    } catch (err) {
        console.error("Booking API error:", err);
        throw err;
    }
}

// Helper to get workout ID by slot ID
function getWorkoutIdBySlotId(slotId) {
    const activity = Object.values(ActivityType).find(a => a.id === slotId);
    return activity ? activity.workoutId : null;
}

// Helper to generate booking timestamp (for simplicity, using current time)
function getBookingTimestamp(dateStr, slotId) {
    const dateTimeStr = `${dateStr} ${slotId}`;
    const dt = new Date(dateTimeStr);
    return Math.floor(dt.getTime()); // milliseconds
}

async function makeAPICall(request, host, path, method, headers) {
    if (config.userAgent) {
        headers['User-Agent'] = config.userAgent;
    }
    if (config.referer) {
        headers['referer'] = config.referer;
    }

    const url = `https://${host}${path}`;
    const options = {
        method: method,
        headers: headers
    };

    if (method === 'POST') {
        options.body = JSON.stringify(request);
    }

    const response = await fetch(url, options);

    const responseText = await response.text();

    if (!response.ok) {
        console.error("Request failed with status", response.status);
        console.error("Response body:", responseText);
        throw new Error(responseText);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return JSON.parse(responseText);
    }
    return responseText;
}

function getSlots(classesForDay, slot, sportTypes) {
    let timeSlot = classesForDay.classByTimeList.find(t => t.id == slot);
    if (!timeSlot) {
        return [];
    }

    let centerClasses = timeSlot.centerWiseClasses.find(c => c.centerId == PREFERRED_CENTER);
    if (!centerClasses) {
        return [];
    }

    let slotIDs = centerClasses.classes.filter(classs => {
        const matchSportType = sportTypes.some(st => st.id === classs.sportId && st.name === classs.sportName);
        if (!matchSportType) return false;

        if (ENABLE_WAITLIST) {
            return classs.state === 'AVAILABLE' || classs.state === 'WAITLIST_AVAILABLE';
        } else {
            return classs.state === 'AVAILABLE';
        }
    }).map(classs => {
        return {
            id: classs.id,
            state: classs.state,
            availableSeats: classs.availableSeats,
            waitlistInfo: classs.waitlistInfo,
            startTime: classs.startTime,
            date: classs.date,
            workoutName: classs.workoutName
        };
    }).sort((a, b) => {
        const prefA = sportTypes.find(st => st.id === a.sportId).preference;
        const prefB = sportTypes.find(st => st.id === b.sportId).preference;
        return prefA - prefB;
    });

    return slotIDs;
}

function errorHandler(error) {
    console.error("Booking failed:", error);
}
