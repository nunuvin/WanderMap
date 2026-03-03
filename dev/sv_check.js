const fetch = require('node-fetch');

// Street view validation check
async function checkStreetView(lat, lng) {
    // We want to verify if street view exists at a location WITHOUT api key.
    // The current code embeds:
    // https://www.google.com/maps?layer=c&cbll={lat},{lng}&cbp=11,0,0,0,0&ncr=1&hl=en&gl=US&output=svembed

    // A known undocumented endpoint that can be used client-side (CORS allowed or JSONP) is needed, OR
    // we just check if the embed URL returns a valid page vs an error page. Wait, embed URL is iframe, so we can't read it from client due to CORS.
    // Actually, another way to get panorama ID from coordinates without API key is using:
    // https://maps.googleapis.com/maps/api/js/GeoPhotoService.SingleImageSearch?pb=!1m5!1sapiv3!5sUS!11m2!1m1!1b0!2m4!1m2!3d${lat}!4d${lng}!2d50!3m10!2m2!1sen!2sUS!9m1!1e2!11m4!1m3!1e2!2b1!3e2!4m10!1e1!1e2!1e3!1e4!1e8!1e6!5m1!1e2!6m1!1e2&callback=foo
    // This is what some client-side libraries do to bypass API key requirement. Let's test it.

    const url = `https://maps.googleapis.com/maps/api/js/GeoPhotoService.SingleImageSearch?pb=!1m5!1sapiv3!5sUS!11m2!1m1!1b0!2m4!1m2!3d${lat}!4d${lng}!2d50!3m10!2m2!1sen!2sUS!9m1!1e2!11m4!1m3!1e2!2b1!3e2!4m10!1e1!1e2!1e3!1e4!1e8!1e6!5m1!1e2!6m1!1e2&callback=foo`;

    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log(`Checking ${lat}, ${lng} -> ${res.status}`);
        // console.log(text.substring(0, 200));

        // If it finds a pano, it usually contains the pano ID in the response
        // if it doesn't, it usually returns a different structure or empty result
        if (text.includes('[[[2,') || text.match(/\[\[\[2,/)) { // Rough heuristic for success response structure
            console.log('Likely found a panorama');
            return true;
        } else if (text.includes('[[[1,')) {
             console.log('Likely NO panorama');
             return false;
        } else {
             console.log('Unknown response format');
             console.log(text.substring(0, 500));
        }

    } catch (e) {
        console.error(e);
    }
}

async function run() {
    console.log("Testing known valid location (SF):");
    await checkStreetView(37.7749, -122.4194);

    console.log("\nTesting known INVALID location (Ocean):");
    await checkStreetView(0, 0);

    console.log("\nTesting another valid location (NY):");
    await checkStreetView(40.7128, -74.0060);
}

run();
