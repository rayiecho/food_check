# FoodCheck – Allergen & Nutrition Checker for Restaurants

FoodCheck helps restaurant owners and cooks check the **allergens** and **nutrition** of the food they buy and cook with. You can answer a customer's "does this contain nuts?" in seconds, label your menu correctly, and choose healthier suppliers.

-  **Live app (via load balancer):** http://18.171.56.14
-  **Demo video:** https://youtu.be/cPq1IfaVpIE
-  **Repository:** https://github.com/rayiecho/food_check

## Features
- **Search** packaged products (sauces, drinks, biscuits) or raw ingredients (rice, chicken, tomato)
- **Filter** by allergen (hide anything with milk, gluten, nuts, peanuts, eggs or soy), by health grade (Nutri-Score A–E) and by name
- **Sort** by name, lowest calories, lowest sugar, lowest fat or highest protein
- **Clear presentation:** coloured Nutri-Score badges, allergen tags and a sugar bar on each card
- **Error handling:** friendly messages for empty or too-long searches, API downtime, timeouts and lost internet
- **Security:** the API key stays on the server (`.env`, never sent to the browser or GitHub); input is validated and all text is escaped against XSS
- **Caching:** API answers are cached for 10 minutes to load faster and reduce API calls

## APIs used (credits)
| API | Used for | Docs |
|---|---|---|
| **Open Food Facts** (search-a-licious), by the Open Food Facts community | Packaged products, allergens, Nutri-Score | https://openfoodfacts.github.io/openfoodfacts-server/api/ · https://search.openfoodfacts.org/docs |
| **USDA FoodData Central**, by the U.S. Department of Agriculture | Raw ingredient nutrition | https://fdc.nal.usda.gov/api-guide |

Other resources: [Node.js](https://nodejs.org), [Express](https://expressjs.com), [dotenv](https://github.com/motdotla/dotenv), [PM2](https://pm2.keymetrics.io), [Nginx](https://nginx.org), [HAProxy](https://www.haproxy.org).

## Project structure
```
server.js          # Express server: API routes, caching, validation, error handling
public/index.html  # Page layout
public/style.css   # Styling
public/app.js      # Search, filter, sort and display logic
.env.example       # Template for the secret key (the real .env is git-ignored)
```

## Run locally
Requirements: Node.js 18+ and a free USDA key from https://fdc.nal.usda.gov/api-key-signup
```bash
git clone https://github.com/rayiecho/food_check.git
cd food_check
npm install
cp .env.example .env      # then put your real key in .env
node server.js
```
Open http://localhost:3000

## Deployment

### Web servers (Web01: 16.60.187.37, Web02: 18.133.243.199)
Same steps on both servers:
```bash
# 1. Install Node.js 20, nginx and git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git

# 2. Get the code and install
git clone https://github.com/rayiecho/food_check.git foodcheck
cd foodcheck && npm install --omit=dev

# 3. Create .env with USDA_API_KEY=... and PORT=3000

# 4. Keep the app running (and restart it on reboot) with PM2
sudo npm install -g pm2
pm2 start server.js --name foodcheck
pm2 startup     # run the command it prints
pm2 save
```
Nginx (`/etc/nginx/sites-available/default`) forwards port 80 to the app on port 3000 and adds a header showing which server answered:
```nginx
server {
    listen 80 default_server;
    server_name _;
    add_header X-Served-By $hostname always;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
```bash
sudo nginx -t && sudo systemctl restart nginx
```

### Load balancer (Lb01: 18.171.56.14)
```bash
sudo apt-get install -y haproxy
```
`/etc/haproxy/haproxy.cfg`:
```
frontend foodcheck_front
    bind *:80
    default_backend foodcheck_back

backend foodcheck_back
    balance roundrobin
    option httpchk GET /api/health
    server web-01 16.60.187.37:80 check
    server web-02 18.133.243.199:80 check
```
```bash
sudo haproxy -c -f /etc/haproxy/haproxy.cfg && sudo systemctl restart haproxy
```
- **Round robin** sends requests to Web01 and Web02 in turn.
- **Health checks** (`/api/health`) stop traffic to a server that goes down.

### Testing the load balancer
```bash
for i in 1 2 3 4; do curl -s http://18.171.56.14/api/health; echo; done
```
Result: the answers alternate between the two servers:
```
{"status":"ok","server":"7245-web-01"}
{"status":"ok","server":"7245-web-02"}
{"status":"ok","server":"7245-web-01"}
{"status":"ok","server":"7245-web-02"}
```

## Challenges and solutions
1. **Open Food Facts returned 503 (overloaded).** Its old search endpoint (`cgi/search.pl`) was unreliable, so I switched to the newer search-a-licious API (`search.openfoodfacts.org`), which is faster and stable.
2. **USDA requests failed with `ETIMEDOUT` on WSL**, although `curl` worked. Node 20 tries IPv6 and IPv4 with a very short timeout. Fixed with `dns.setDefaultResultOrder("ipv4first")` and `net.setDefaultAutoSelectFamily(false)`.
3. **No API key in Open Food Facts.** To demonstrate secure key handling, I added USDA FoodData Central, whose key is kept server-side only.
4. **Pasting long command blocks on the servers.** `apt-get` consumed the lines pasted after it, so I ran the install separately. `nano` was missing, so I created `.env` with `cat > .env <<'EOF'`.
5. **Missing data:** some products lack nutrition values. These show as "–" and are sorted to the end.

## AI Usage & CodeVibe Report

This project was tracked with CodeVibe from the start of development
(assignment record: "Summative - Building Responsive UI", Nov 24 → Nov 25).

### Setup before development
Before writing any code for this assignment, I disabled the Claude Code
extension for this workspace and turned off VS Code's built-in AI features
(`chat.disableAIFeatures`). No AI coding assistant was active in this project
while I worked on it. I then installed CodeVibe, created the assignment record
with the Department's fixed thresholds (20% maximum AI authorship, 100 minimum
ownership), and linked the repository.

### Why the AI authorship figure is high
- **Pasted practice code:** A large part of the starting code was pasted from my
  own earlier practice work. CodeVibe cannot tell the difference between pasted
  code and AI-generated code, so it recorded these pastes as non-manual. This
  put the early figure at 72.9%, even though the code is my own.
- **Manual development:** I continued building the project by typing the code
  myself, which brought the figure down to about 30% before I exported the
  report.
- **Effect of exporting:** When I ran "CodeVibe: Export Assignment Report", the
  report file was saved inside the project folder. Right after that, the live
  dashboard rose to 98.2% (status bar: 99% AI). CodeVibe appears to have
  counted the newly written report file as non-manual code. I did not edit,
  rename or regenerate the report after exporting it.

### "Agentic AI use detected" flag
CodeVibe labels any file changed on disk without typing in the editor as
"agentic". No AI agent was running in this project. The flagged changes come
from actions taken outside the editor, such as `npm install` updating
`package.json`/`package-lock.json`, the report export writing its file, and
large pastes from my practice code.

### Ownership
My ownership score is 100/100: every file was opened, read through, navigated
and edited by me.