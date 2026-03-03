const fetch = require('node-fetch');

async function hasStreetView(lat, lng) {
    const url = `https://maps.googleapis.com/maps/api/js/GeoPhotoService.SingleImageSearch?pb=!1m5!1sapiv3!5sUS!11m2!1m1!1b0!2m4!1m2!3d${lat}!4d${lng}!2d50!3m10!2m2!1sen!2sUS!9m1!1e2!11m4!1m3!1e2!2b1!3e2!4m10!1e1!1e2!1e3!1e4!1e8!1e6!5m1!1e2!6m1!1e2&callback=svCallback`;

    try {
        const res = await fetch(url);
        if (!res.ok) return false;
        const text = await res.text();
        return text.includes('[[[2,');
    } catch (e) {
        return false;
    }
}

async function run() {
    console.log("SF:", await hasStreetView(37.7749, -122.4194));
    console.log("Ocean:", await hasStreetView(0, 0));
    console.log("Middle of nowhere:", await hasStreetView(45.0, -110.0));
    console.log("Berlin:", await hasStreetView(52.5200, 13.4050));
}

run();
