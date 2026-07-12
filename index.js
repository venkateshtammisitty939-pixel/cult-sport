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
    "GET_CLASSES": "/api/sport/classes/v2?productType=SPORT", // Changed endpoint
    "BOOK_CLASS": "/api/sport/slot/${slotID}/book" // Changed endpoint
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

function hasBookingForDate(classesForDay) {
    for (let timeSlot of classesForDay.classByTimeList) {
        for (let centerClass of timeSlot.centerWiseClasses) {
            if (centerClass.centerId === PREFERRED_CENTER) {
                for (let classs of centerClass.classes) {
                    if (classs.state === 'BOOKED' || classs.isBooked === true) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

async function main() {
    try {
        let classes = await makeAPICall({}, CURE_FIT_HOST, URI.GET_CLASSES, HTTP_GET, commonHeaders);
        let date = classes.days[classes.days.length - 1].id;
        
        console.log(`Booking for ${date}`);
        
        if (hasBookingForDate(classes.classByDateMap[date])) {
            console.log(`Already booked on ${date}. Skipping.`);
            return;
        }
        
        let slots = [];
        
        for (let slot of PREFERRED_SLOTS) {
            slots = getSlots(classes.classByDateMap[date], slot, PREFERRED_SPORTS_IN_ORDER);
            
            if (slots.length > 0) {
                let sportInfo = slots[0];
                console.log(`Found ${PREFERRED_SPORT_NAME} at ${slot} on ${date}`);
                
                if (sportInfo.state === 'WAITLIST_AVAILABLE') {
                    let waitlistCount = sportInfo.waitlistInfo && sportInfo.waitlistInfo.waitlistedUserCount || 0;
                    console.log(`Joining waitlist (${waitlistCount} people ahead)`);
                } else {
                    console.log(`Booking (${sportInfo.availableSeats} seats available)`);
                }
                
                await bookSport(sportInfo.id);
                console.log("Sport slot booked successfully!");
                break;
            }
        }
        
        if (slots.length === 0) {
            console.log(`No ${PREFERRED_SPORT_NAME} slots available on ${date}`);
        }
    } catch (error) {
        errorHandler(error);
    }
}

main();

async function bookSport(slotID) {
    return await makeAPICall({}, CURE_FIT_HOST, "/api/sport/slot/" + slotID + "/book", HTTP_POST, commonHeaders);
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

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    }

    return await response.text();
}

function getSlots(classesForDay, slot, sportTypes) {
    
    let timeSlot = classesForDay.classByTimeList.filter(function (classByTime) {
        return classByTime.id == slot;
    })[0];
    
    if (!timeSlot) {
        return [];
    }
    
    let centerClasses = timeSlot.centerWiseClasses.filter(function (center) {
        return center.centerId == PREFERRED_CENTER;
    })[0];
    
    if (!centerClasses) {
        return [];
    }
    
    let slotIDs = centerClasses.classes.filter(function (classs) {
        let filterElement = sportTypes.filter(function (sportType) {
            return sportType.id == classs.sportId && sportType.name == classs.sportName
        })[0];
        if (!filterElement) {
            return false;
        }
        classs.preference = filterElement.preference;
        
        if (ENABLE_WAITLIST) {
            return classs.state === 'AVAILABLE' || classs.state === 'WAITLIST_AVAILABLE';
        } else {
            return classs.state === 'AVAILABLE';
        }
    })
    .sort(function (slot1, slot2) {
        return slot1.preference - slot2.preference;
    });
    
    return slotIDs;
}

function errorHandler(error) {
    console.error("Booking failed:", error);
}
