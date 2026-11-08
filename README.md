# Spark – DatingApp (front-end prototype)

A responsive, location-aware dating & meetup web app built with **HTML5, CSS3 and vanilla JavaScript only**.
No backend, no build step – open `index.html` in a browser and it runs. All data lives in `localStorage`.

## Run it
1. Unzip the folder.
2. Double-click `index.html` (Chrome, Edge, Firefox or Safari).
3. An internet connection is needed only for the map tiles (and optional Google Fonts are *not* used).

## Logins
| Who | Username / Email | Password | Goes to |
|---|---|---|---|
| Demo member | `demo` or `demo@spark.app` | `demo123` | `index.html` (avatar appears in navbar) |
| Any dummy member | e.g. `aanya1` | `demo123` | `index.html` |
| Admin | `admin` | `admin` | `admin.html` |
| New member | click **Sign Up** | your own | onboarding pop-up → location pop-up |

There is **one login form** for everyone. The admin has no separate button and no navbar link:

```js
if (username === "admin" && password === "admin") window.location.href = "admin.html";
else window.location.href = "index.html";   // members (profile via the avatar menu)
```

## Pages
| File | Purpose |
|---|---|
| `index.html` | Full-screen live map (Uber style), floating profile markers, nearby panel, Available/Unavailable switch |
| `discover.html` | Bumble/Tinder-style cards: like, pass, request to meet; filters |
| `booking.html` | "I'd like to meet / I would not like to meet" categories, age + distance filters, session request, my sessions (accept / decline / cancel / complete) |
| `profile.html` | Edit profile, avatar upload, privacy & location, dark mode, delete account |
| `admin.html` | Dashboard, analytics, user CRUD (view / edit / delete / add), booking management, reports, settings |
| `about.html`, `contact.html`, `privacy.html` | Info pages + footer links. Contact messages show up in the admin Reports section |

## How the requirements map
- **Login/Sign up buttons before login; profile avatar in the top-right after login** – `js/app.js → renderHeader()`
- **Asks gender + more details after sign-up and saves them to the "database"** – onboarding modal in `js/auth.js`
- **Location pop-up like Uber** – shown automatically after login until you decide (`Enable location` / choose a city / `Not now`)
- **Dummy woman/man head instead of cars** – generated SVG avatars (`DA.avatar`), or your uploaded photo
- **Teams-style Available / Unavailable** – navbar status button and panel switch; only *Available + location shared* members appear to others
- **Booking with preferences** – women, men, young women/men (18–25), married women, single mothers, sugar mummy, sugar daddy; include list, exclude list, age and distance filters
- **Real-time feel** – dummy people drift and change status every few seconds; a second browser tab updates instantly through the `storage` event
- **Premium UI** – animated logo, animated gradient background, glass cards, hover effects, optional video background, dark mode

## Map
`js/map.js` contains a small slippy-map written in plain JavaScript using OpenStreetMap raster tiles (no API key). The public tile service has a usage policy; use a hosted tile provider for production or high-traffic deployments.
To switch to **Google Maps** you need your own API key and the Maps JavaScript API: load it in the page and replace the `MiniMap`
class with a wrapper that exposes the same methods (`setMarkers`, `setMe`, `setView`, `zoomBy`, `onMapClick`).

## Optional assets
- `assets/videos/background.mp4` – short looping muted clip for the "How it works" band (falls back to a gradient).
- `assets/images/` – put your own images here.

## Safety design choices
- 18+ only (checked at sign-up, onboarding and every age field).
- Other members see an **approximate** location (~±180 m), never the exact one. Logged-out visitors only see blurred markers.
- A booking is only a **request**; the other person must accept. No payments are handled.
- Users can hide instantly (Unavailable) or stop sharing location in their profile.

## Important – before any real launch
This is a prototype. **Do not use it with real people's data as-is.**
- Passwords are stored in plain text in `localStorage`, and `admin / admin` is checked in the browser. Replace with server-side authentication, hashed passwords and role checks.
- `admin.html` is "protected" only by a client-side check – anyone can edit `localStorage`.
- A real product needs a backend/database, identity & age verification, moderation, reporting/blocking, rate limiting and a legal/privacy review.

## Folder structure
```
DatingApp/
├── index.html  about.html  contact.html  privacy.html
├── discover.html  booking.html  profile.html  admin.html
├── css/   style.css  responsive.css  animations.css
├── js/    app.js  auth.js  map.js  profile.js  booking.js  admin.js
├── assets/ images/  videos/  icons/  logo/
└── README.md
```
(`discover.html` logic lives in `js/map.js`; contact-form handling lives in `js/app.js`.)

Reset all demo data any time: Admin → Settings → **Reset demo data** (or clear this site's localStorage).
