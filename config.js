require('dotenv').config();

function parseCurlCommand(curlString) {
    const config = {
        apiKey: "",
        appVersion: "",
        browserName: "",
        osName: "",
        timezone: "",
        cookies: "",
        userAgent: "",
        referer: ""
    };

    const apikeyMatch = curlString.match(/-H\s+'apikey:\s*([^']+)'/);
    if (apikeyMatch) config.apiKey = apikeyMatch[1];

    const appversionMatch = curlString.match(/-H\s+'appversion:\s*([^']+)'/);
    if (appversionMatch) config.appVersion = appversionMatch[1];

    const browsernameMatch = curlString.match(/-H\s+'browsername:\s*([^']+)'/);
    if (browsernameMatch) config.browserName = browsernameMatch[1];

    const osnameMatch = curlString.match(/-H\s+'osname:\s*([^']+)'/);
    if (osnameMatch) config.osName = osnameMatch[1];

    const timezoneMatch = curlString.match(/-H\s+'timezone:\s*([^']+)'/);
    if (timezoneMatch) config.timezone = timezoneMatch[1];

    const cookieMatch = curlString.match(/-b\s+'([^']+)'/);
    if (cookieMatch) {
        config.cookies = cookieMatch[1];
    }

    const userAgentMatch = curlString.match(/-H\s+'user-agent:\s*([^']+)'/);
    if (userAgentMatch) config.userAgent = userAgentMatch[1];

    const refererMatch = curlString.match(/-H\s+'referer:\s*([^']+)'/);
    if (refererMatch) config.referer = refererMatch[1];

    return config;
}

let config;

if (process.env.CURL_COMMAND) {
    config = parseCurlCommand(process.env.CURL_COMMAND);
} else if (process.env.COOKIES) {
    config = {
        apiKey: process.env.API_KEY || "9d153009-e961-4718-a343-2a36b0a1d1fd",
        appVersion: process.env.APP_VERSION || "7",
        browserName: process.env.BROWSER_NAME || "Chrome",
        osName: process.env.OS_NAME || "browser",
        timezone: process.env.TIMEZONE || "Asia/Kolkata",
        cookies: process.env.COOKIES
    };
} else {
    throw new Error(
        "No credentials found!\n\n" +
        "Please set CURL_COMMAND environment variable.\n" +
        "For GitHub Actions: Add it as a repository secret.\n" +
        "For local testing: export CURL_COMMAND='your curl command here'\n\n" +
        "See SETUP.md for instructions."
    );
}

config.preferredCenter = process.env.PREFERRED_CENTER ? parseInt(process.env.PREFERRED_CENTER) : null;
config.preferredSlots = process.env.PREFERRED_SLOTS ? process.env.PREFERRED_SLOTS.split(',') : null;
config.preferredWorkout = process.env.PREFERRED_SPORT || null;
config.enableWaitlist = process.env.ENABLE_WAITLIST !== 'false';

module.exports = config;
