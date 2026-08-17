# Website ko Live Karne ke Steps

Project ab Node.js + Express web service ke roop me ready hai. Contact form backend se email bhejega.

## 1. Gmail App Password ready karein

Website ka enquiry form `shreegajanandindia751@gmail.com` par mail bhejne ke liye SMTP use karta hai.

1. Google Account me 2-Step Verification ON karein.
2. Google Account me App Password create karein.
3. Milne wala 16-character App Password safe rakhein.
4. Normal Gmail password ko website code me kabhi mat dalein.

## 2. GitHub par upload

Is folder ke saare files GitHub repository ke root me upload/push karein. `node_modules` upload karne ki zarurat nahi hai.

## 3. Render par deploy

1. Render Dashboard kholen.
2. **New > Blueprint** select karein.
3. Apni GitHub repository connect karein.
4. Render root ka `render.yaml` detect karega.
5. Environment/secret values set karein:

```text
SMTP_USER=shreegajanandindia751@gmail.com
SMTP_PASS=YOUR_16_CHARACTER_GOOGLE_APP_PASSWORD
EMAIL_FROM=shreegajanandindia751@gmail.com
EMAIL_TO=shreegajanandindia751@gmail.com
```

6. Deploy start karein.
7. Deploy ke baad `/health` open karne par `{"status":"ok"}` aana chahiye.
8. Contact page se ek test enquiry submit karke Gmail inbox verify karein.

> Included Blueprint `free` instance use karta hai taaki initial testing bina paid instance ke ho sake. Business production use ke liye Render ka paid instance choose karna better rahega.

## 4. Custom Domain connect karna

1. Render service > **Settings > Custom Domains** me apna domain add karein.
2. Render jo DNS records bataye, wahi apne domain provider ke DNS panel me add karein.
3. Render me domain verify karein.
4. Verification ke baad HTTPS certificate Render automatically manage karta hai.

## Local Test

PowerShell me project folder open karke:

```powershell
npm ci
Copy-Item .env.example .env
notepad .env
npm start
```

Sirf local form test ke liye `.env` me ye line add kar sakte hain:

```text
MAIL_MODE=console
```

Phir browser me `http://localhost:3000` open karein. `MAIL_MODE=console` real email nahi bhejega; enquiry terminal me print hogi.
