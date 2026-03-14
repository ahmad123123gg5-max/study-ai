<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/06c399f9-cac6-42a1-8bba-cf515d9c71c4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env` from `.env.example` and set:
   - `OPENAI_API_KEY` (server-side OpenAI key)
   - `OPENAI_MODEL` (optional, default: `gpt-4o-mini`)
3. Run the app (web + API together):
   `npm run dev`
## أكواد PRO الترويجية

- توليد الأكواد: `npm run promo:generate` أو `node scripts/generate-promo-codes.mjs` يُنشئ 20 كوداً فريداً ويطبعها في الطرفية؛ أضف `--force` إذا أردت إعادة توليد حتى وإن كانت هناك أكواد سابقة محفوظة.
- استرداد الكود: بعد تسجيل الدخول يرسل العميل طلب `POST /api/promo/redeem` مع الحقل `code`. يتم تحويل الكود إلى حروف كبيرة، التحقق من أنه غير مستخدم، ربطه بالحساب الحالي، وضبط الحقول `proAccessStartAt` و`proAccessEndAt` مع `premiumSource: 'promo_code'`.
- بداية الـ 14 يوماً: التاريخ يبدأ من لحظة التفعيل، ويُسجل الخادم `proAccessStartAt` و`proAccessEndAt` ويعرضها في الواجهة (تاريخ البداية، تاريخ الانتهاء، الأيام المتبقية).
- فرض انتهاء الوصول: عند قراءة البيانات تُشغّل `refreshSubscriptionState` التي تعيد ضبط الخطة إلى `free` بعد مرور `proAccessEndAt`، وتمنع حراس المميزات من منح صلاحيات PRO بعد انتهاء التجربة، بينما تظل الصفحة المختصة بالاشتراك تعرض تاريخ الانقضاء.