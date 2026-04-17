import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// ─── Axios Configuration & Security Interceptors ───────────────────────────
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('svm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => Promise.reject(error));

axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Session expired or invalid
      if (localStorage.getItem('svm_token')) {
        localStorage.removeItem('svm_token');
        window.location.reload(); // Force full app reset to login
      }
    }
    return Promise.reject(error);
  }
);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const calculateInterest = (amount, rate, startDate, endDate = new Date()) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (end <= start) return 0
  const diffTime = Math.abs(end - start)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const dailyInterest = Math.round((amount * (rate * 12 / 100)) / 365)
  return dailyInterest * diffDays
}

const getLoanState = (loan, targetDate = new Date()) => {
  let currentPrincipal = loan.amount
  let interestDue = 0
  let lastEventDate = new Date(loan.date)
  
  const sortedPayments = [...(loan.payments || [])].sort((a, b) => new Date(a.date) - new Date(b.date))
  
  for (const payment of sortedPayments) {
    const payDate = new Date(payment.date)
    if (payDate > targetDate) break
    
    const accrued = calculateInterest(currentPrincipal, loan.interest, lastEventDate, payDate)
    interestDue += accrued
    
    if (payment.amount >= interestDue) {
      const principalReduction = payment.amount - interestDue
      interestDue = 0
      currentPrincipal = Math.max(0, currentPrincipal - principalReduction)
    } else {
      interestDue -= payment.amount
    }
    lastEventDate = payDate
  }
  
  const finalAccrued = calculateInterest(currentPrincipal, loan.interest, lastEventDate, targetDate)
  interestDue += finalAccrued
  
  return {
    currentPrincipal,
    interestDue,
    outstanding: currentPrincipal + interestDue
  }
}

// ─── Receipt / PDF Generator ─────────────────────────────────────────────────
const printReceipt = (loan, type, paymentData = null) => {
  const win = window.open('', '_blank', 'width=960,height=760')
  if (!win) { alert('Please allow popups to generate receipts.'); return }

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'
  const cur = (n) => '\u20b9' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

  const today    = new Date()
  const refDate  = loan.releasedDate ? new Date(loan.releasedDate) : today
  const state    = getLoanState(loan, refDate)
  
  const totalDue = state.outstanding
  const accrued  = state.interestDue
  const currentPrincipal = state.currentPrincipal

  const custPhotoHtml = loan.customerPhoto
    ? `<img src="${loan.customerPhoto}" style="width:100%;height:100%;object-fit:cover" />`
    : `<div style="font-size:8.5px;color:#bbb;text-align:center;padding:6px;">No Photo<br/>Captured</div>`
  const goldPhotoHtml = loan.goldPhoto
    ? `<img src="${loan.goldPhoto}" style="width:100%;height:100%;object-fit:cover" />`
    : `<div style="font-size:8.5px;color:#bbb;text-align:center;padding:6px;">No Photo<br/>Captured</div>`

  // ── LOAN RECEIPT: Muthoot-style 3-column layout with photos ─────────────────
  const loanHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>GOLD LOAN RECEIPT - ${loan.id}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:11px;color:#000;background:#eee}
.page{max-width:860px;margin:16px auto;background:#fff;padding:14px 16px;border:2px solid #333}
.hdr-t{width:100%;border-collapse:collapse;border-bottom:2px solid #333;margin-bottom:6px;padding-bottom:6px}
.logo-box{width:58px;height:58px;background:#D4AF37;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#000}
.shop-nm{font-size:20px;font-weight:900;color:#D4AF37;letter-spacing:2px;line-height:1.2}
.shop-sub{font-size:9px;color:#666;margin-top:2px;font-style:italic}
.title-bar{display:flex;justify-content:space-between;align-items:center;border:1px solid #999;background:#f5f5f5;padding:5px 10px;margin-bottom:6px;font-size:12px;font-weight:900;letter-spacing:1.5px}
.main-t{width:100%;border-collapse:collapse;margin-bottom:6px}
.main-t td{border:1px solid #999;vertical-align:top;padding:7px 9px}
.sl{font-size:8px;color:#888;text-transform:uppercase;font-weight:700;letter-spacing:.5px;margin-bottom:3px}
.sv{font-size:13px;font-weight:700}
.in-t{width:100%;border-collapse:collapse}
.in-t td{border:1px solid #ddd;padding:4px 6px;font-size:10px}
.in-t td:first-child{color:#777;font-weight:700;text-transform:uppercase;font-size:8.5px;white-space:nowrap}
.in-t td:last-child{font-weight:700;font-size:11.5px}
.ph-wrap{display:flex;gap:8px;justify-content:center}
.ph-blk{text-align:center;flex:1}
.ph-lbl{font-size:8px;color:#888;font-weight:700;text-transform:uppercase;margin-bottom:4px}
.ph-box{width:100%;height:116px;border:1px solid #ccc;background:#f8f8f8;overflow:hidden;display:flex;align-items:center;justify-content:center}
.wt-t{width:100%;border-collapse:collapse;margin-bottom:6px}
.wt-t th,.wt-t td{border:1px solid #999;padding:5px 8px;font-size:10.5px}
.wt-t th{background:#f2f2f2;font-weight:700;text-align:center;font-size:9px;text-transform:uppercase}
.wt-t td{text-align:center;font-weight:700}
.wt-t td:first-child{text-align:left;font-weight:700}
.amt-bar{background:linear-gradient(90deg,#D4AF37,#B8860B);color:#000;padding:10px 16px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;border-radius:4px}
.amt-lbl2{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.amt-val2{font-size:26px;font-weight:900}
.terms{border:1px solid #ddd;padding:7px 10px;font-size:8.5px;color:#555;line-height:1.7;margin-bottom:6px}
.sig-row{display:flex;justify-content:space-between;margin-top:28px;margin-bottom:8px}
.sig-blk{text-align:center;width:42%}
.sig-ln{border-top:1px solid #333;margin-top:40px;padding-top:5px;font-size:10px;font-weight:700}
  .footer2{background:#1a1a1a;color:#fff;text-align:center;padding:7px;font-size:9px;letter-spacing:.5px}
  .pbtn{position:fixed;bottom:18px;right:18px;background:#D4AF37;color:#000;border:none;padding:12px 24px;border-radius:8px;font-weight:900;font-size:13px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;box-shadow:0 4px 166px rgba(0,0,0,.25);z-index:999}
  .cut-line { display: none; }
  .terms-page { display: block; border: 2px solid #333; padding: 25px; margin-top: 20px; background: #fff; position: relative; }
  .terms-hdr { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
  .terms-list { font-size: 11px; line-height: 1.8; color: #111; }
  .terms-item { margin-bottom: 12px; text-align: justify; }
  .terms-item b { color: #000; display: block; margin-bottom: 2px; }
  @media print{
    .pbtn{display:none} 
    .page{margin:0;border:2px solid #333;padding:15px;page-break-after:always;}
    .terms-page { margin-top: 0; border: 2px solid #333; padding: 25px; min-height: 100vh; page-break-before: always; page-break-after: always; }
    body{background:#fff}
    .cut-line{display:block;border-top:2px dashed #999;margin:30px 0;page-break-before:always;}
  }
</style></head><body>
${['CUSTOMER', 'OFFICE'].map((copyType, index) => `
<div class="page" ${index === 1 ? 'style="border-style: dashed;"' : ''}>
<table class="hdr-t"><tr>
  <td style="width:68px;padding:4px 10px 4px 0;vertical-align:middle"><div class="logo-box">V</div></td>
  <td style="vertical-align:middle;padding:4px 0">
    <div class="shop-nm">Sri Vishnu Madha Nagai Adagu Kadai</div>
    <div class="shop-sub">Vaiyampatti Road, Irumathur, Karimangalam, Dharmapuri-635201</div>
    <div class="shop-sub" style="font-style: normal; color: #333; font-weight: 700;">Contact: 7339638249, 8270774080</div>
  </td>
  <td style="text-align:right;vertical-align:middle;padding-right:4px;font-size:10px">
    <div style="font-size:11px;font-weight:700">GOLD LOAN RECEIPT</div>
    <div style="font-size:9px;color:#888">Loan No: <b>${loan.id}</b></div>
  </td>
</tr></table>
<div class="title-bar">
  <span>GOLD DEPOSIT RECEIPT (${copyType} COPY)</span>
  <span style="font-weight:400;font-size:10px">Print Date: ${fmt(today)} &nbsp; ${today.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
</div>
<table class="main-t"><tr>
  <td style="width:27%">
    <div class="sl">Customer Name</div>
    <div class="sv" style="font-size:15px;margin-bottom:8px">${loan.name}</div>
    <div class="sl">Mobile Number</div>
    <div class="sv" style="margin-bottom:8px">${loan.phone}</div>
    <div class="sl">Loan Date</div>
    <div class="sv" style="font-size:11px;margin-bottom:8px">${fmt(loan.date)}</div>
    <div class="sl">Status</div>
    <span style="display:inline-block;background:${loan.status === 'Active' ? '#d1fae5' : '#f3f4f6'};color:${loan.status === 'Active' ? '#065f46' : '#6b7280'};padding:2px 10px;border-radius:20px;font-size:9px;font-weight:700">${loan.status}</span>
  </td>
  <td style="width:41%">
    <table class="in-t">
      <tr><td>Loan No.</td><td>${loan.id}</td></tr>
      <tr><td>Loan Amount</td><td style="font-size:14px;font-weight:900;color:#B8860B">${cur(loan.amount)}</td></tr>
      <tr><td>Loan Tenure</td><td>12 Months</td></tr>
      <tr><td>Principal Due Date</td><td>${fmt(loan.dueDate)}</td></tr>
      <tr><td>Interest Rate</td><td style="color:#cc0000;font-weight:900">${loan.interest}% p.m. (${(loan.interest * 12).toFixed(1)}% p.a.)</td></tr>
      <tr><td>Ornament Type</td><td>${loan.ornamentType || 'Gold Jewellery'}</td></tr>
      <tr><td>Purity</td><td>${loan.purity}</td></tr>
      <tr><td>Gross Weight</td><td>${loan.weight} g</td></tr>
    </table>
  </td>
  <td style="width:32%">
    <div class="sl" style="text-align:center;margin-bottom:6px">Evidence Photos</div>
    <div class="ph-wrap">
      <div class="ph-blk">
        <div class="ph-lbl">Customer Photo</div>
        <div class="ph-box">${custPhotoHtml}</div>
      </div>
      <div class="ph-blk">
        <div class="ph-lbl">Ornaments Photo</div>
        <div class="ph-box">${goldPhotoHtml}</div>
      </div>
    </div>
  </td>
</tr></table>
<div class="amt-bar">
  <div>
    <div class="amt-lbl2">Total Loan Amount Disbursed</div>
    <div style="font-size:9px;opacity:.8;margin-top:2px">Interest @ ${loan.interest}% per month &nbsp;|&nbsp; Due: ${fmt(loan.dueDate)}</div>
  </div>
  <div class="amt-val2">${cur(loan.amount)}</div>
</div>
<table class="wt-t">
  <thead><tr>
    <th style="text-align:left;width:50%">Particulars (Description of Jewellery)</th>
    <th>Gross Weight (g)</th>
    <th>Stone / Others (g)</th>
    <th>Net Weight approx. (g)</th>
  </tr></thead>
  <tbody><tr>
    <td>${loan.ornamentType || 'Gold Jewellery'} &mdash; ${loan.purity} Purity</td>
    <td>${loan.weight}</td>
    <td>${loan.stoneWastage || 0}</td>
    <td>${(parseFloat(loan.weight) - parseFloat(loan.stoneWastage || 0)).toFixed(2)}</td>
  </tr></tbody>
</table>
<div class="sig-row">
  <div class="sig-blk"><div class="sig-ln">Signature of the Borrower</div><div style="font-size:10px;color:#555;margin-top:2px">${loan.name}</div></div>
  <div class="sig-blk"><div class="sig-ln">Signature of Branch Manager</div><div style="font-size:10px;color:#555;margin-top:2px">Sri Vishnu Madha Nagai Adagu Kadai</div></div>
</div>
<div class="footer2">Sri Vishnu Madha Nagai Adagu Kadai &bull; Vaiyampatti Road, Irumathur &bull; Contact: 7339638249 &bull; &copy; ${new Date().getFullYear()}</div>
</div>
<div class="terms-page">
  <div class="terms-hdr">
    <div style="font-size: 18px; font-weight: 900; color: #D4AF37;">Sri Vishnu Madha Nagai Adagu Kadai</div>
    <div style="font-size: 12px; font-weight: 700; margin-top: 5px;">விதிமுறைகள் மற்றும் நிபந்தனைகள் (Terms & Conditions)</div>
    <div style="font-size: 10px; margin-top: 3px;">Loan No: ${loan.id} &bull; ${copyType} COPY</div>
  </div>
  <div class="terms-list">
    <div class="terms-item"><b>1. காலக்கெடு (Loan Period):</b> இந்தக் கடனின் கால அளவு 12 மாதங்கள் மட்டுமே. காலக்கெடு முடிவதற்குள் அசலையும் வட்டியையும் செலுத்தி நகையை மீட்க வேண்டும்.</div>
    <div class="terms-item"><b>2. வட்டி விகிதம் (Interest):</b> வட்டி மாதத்திற்கு <b>${loan.interest}%</b> வீதம் கணக்கிடப்படும். ஒரு மாதத்தின் இடையில் நகையை மீட்டாலும், அந்த முழு மாதத்திற்கான வட்டி வசூலிக்கப்படும்.</div>
    <div class="terms-item"><b>3. அடகுச் சீட்டின் முக்கியத்துவம்:</b> நகையை மீட்க வரும்போது இந்த அடகுச் சீட்டை கண்டிப்பாகக் கொண்டு வர வேண்டும். சீட்டு தொலைந்து போனால், உரிய அடையாளச் சான்று மற்றும் அபராதக் கட்டணம் செலுத்தி மாற்றுச் சீட்டு பெற வேண்டும்.</div>
    <div class="terms-item"><b>4. நகையின் எடை மற்றும் தரம்:</b> நகையின் நிகர எடை (Net Weight) மற்றும் தரம் வாடிக்கையாளர் முன்னிலையிலேயே சரிபார்க்கப்பட்டது. இதில் பின்னாளில் ஆட்சேபனை தெரிவிக்க இயலாது.</div>
    <div class="terms-item"><b>5. பகுதிப் பணம் (Part Payment):</b> வாடிக்கையாளர் விரும்பினால் அசல் தொகையில் ஒரு பகுதியை முன்கூட்டியே செலுத்தலாம். அதற்கேற்ப வட்டி குறைக்கப்படும்.</div>
    <div class="terms-item"><b>6. நகைப் பாதுகாப்பு:</b> அடகு வைக்கப்பட்ட நகைகள் பாதுகாப்பான பெட்டகத்தில் வைக்கப்படும். இயற்கை பேரிடர் அல்லது தவிர்க்க முடியாத காரணங்களால் ஏற்படும் இழப்புகளுக்கு நிறுவன விதிமுறைப்படி இழப்பீடு வழங்கப்படும்.</div>
    <div class="terms-item"><b>7. ஏல அறிவிப்பு (Auction):</b> 12 மாதங்களுக்கு மேல் வட்டியோ அல்லது அசலோ செலுத்தப்படாவிட்டால், உரிய முன்னறிவிப்பு இன்றி நகையை பொது ஏலத்தில் விட கடை உரிமையாளருக்கு முழு அதிகாரம் உண்டு.</div>
    <div class="terms-item"><b>8. மேலதிகக் கட்டணங்கள்:</b> குறித்த காலத்திற்குள் வட்டி செலுத்தத் தவறினால், அபராத வட்டி (Penalty Interest) வசூலிக்கப்படும்.</div>
    <div class="terms-item"><b>9. நகை மீட்பு (Redemption):</b> அசலும் வட்டியும் முழுமையாகச் செலுத்திய பின்னரே நகை ஒப்படைக்கப்படும். நகையை மீட்கும்போது அதன் எடையைச் சரிபார்த்துப் பெற்றுக்கொள்வது வாடிக்கையாளரின் பொறுப்பு.</div>
    <div class="terms-item"><b>10. முகவரி மாற்றம்:</b> வாடிக்கையாளர் தனது முகவரி அல்லது தொலைபேசி எண்ணை மாற்றினால், அதை உடனடியாகக் கடைக்குத் தெரிவிக்க வேண்டும்.</div>
  </div>
  <div class="sig-row" style="margin-top: 60px;">
    <div class="sig-blk"><div class="sig-ln">Customer Signature</div></div>
    <div class="sig-blk"><div class="sig-ln">Manager Signature</div></div>
  </div>
  <div class="footer2" style="margin-top: 30px;">This serves as a legal binding agreement between the shop and the customer.</div>
</div>
${index === 0 ? '<div class="cut-line"></div>' : ''}
`).join('')}
<button class="pbtn" onclick="window.print()">\uD83D\uDDA8\uFE0F Print / Save as PDF</button>
</body></html>`

  // ── INTEREST & SETTLEMENT & PAYMENT: clean existing layout ─────────────────────────────
  const titles = { 
    interest: 'INTEREST STATEMENT', 
    settlement: 'SETTLEMENT RECEIPT',
    payment: 'INTEREST PAYMENT RECEIPT'
  }
  const otherHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${titles[type]} - ${loan.id}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#f4f4f4}
.page{max-width:800px;margin:24px auto;background:#fff;padding:44px;border:1px solid #ddd;border-radius:8px}
.hdr{text-align:center;border-bottom:3px double #D4AF37;padding-bottom:22px;margin-bottom:24px}
.logo{width:58px;height:58px;background:#D4AF37;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#000;margin-bottom:10px}
.shop{font-size:26px;font-weight:900;color:#D4AF37;letter-spacing:3px}.tagline{font-size:10px;color:#999;letter-spacing:1px;text-transform:uppercase;margin-top:4px}
.rtitle{display:inline-block;background:#D4AF37;color:#000;font-size:14px;font-weight:900;letter-spacing:3px;padding:6px 28px;border-radius:4px;margin-top:14px}
.meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;background:#f8f8f8;border:1px solid #eee;border-radius:6px;padding:12px 16px;margin-bottom:24px}
.ml{font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}.mv{font-size:13px;font-weight:700}
.sec-title{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#D4AF37;border-bottom:1px solid #D4AF37;padding-bottom:5px;margin-bottom:12px}
.sec{margin-bottom:20px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cell{padding:10px 14px;background:#fafafa;border:1px solid #eee;border-radius:6px}
.cl{font-size:9px;color:#aaa;text-transform:uppercase;margin-bottom:3px;letter-spacing:.5px}.cv{font-size:14px;font-weight:700}
.amt-box{background:linear-gradient(135deg,#D4AF37,#B8860B);color:#000;padding:20px 24px;border-radius:10px;margin:20px 0}
.amt-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:.8}
.amt-val{font-size:34px;font-weight:900;margin:4px 0}.amt-sub{font-size:11px;opacity:.7}
.tbl{width:100%;border-collapse:collapse}.tbl td{padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px}
.tbl td:last-child{text-align:right;font-weight:700}.tbl .tr-total td{border-top:2px solid #D4AF37;font-weight:900;font-size:15px;color:#B8860B}
.terms{background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:14px;margin:20px 0}.terms p{font-size:10px;color:#888;margin-bottom:4px}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:32px}.sig{text-align:center}
.sig-line{border-top:1px solid #555;margin-top:44px;padding-top:6px;font-size:11px;color:#666}
.badge-a{display:inline-block;background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700}
.badge-c{display:inline-block;background:#f3f4f6;color:#6b7280;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700}
.settled-stamp{position:fixed;top:46%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:72px;font-weight:900;color:rgba(0,160,0,.07);pointer-events:none;letter-spacing:6px}
.footer{text-align:center;margin-top:24px;padding-top:14px;border-top:1px solid #eee;font-size:10px;color:#bbb}
.print-btn{position:fixed;bottom:20px;right:20px;background:#D4AF37;color:#000;border:none;padding:13px 26px;border-radius:8px;font-weight:900;font-size:13px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:999}
@media print{.print-btn{display:none}.page{margin:0;border:none;box-shadow:none;padding:28px}body{background:#fff}}
</style></head><body>
${type==='settlement'?'<div class="settled-stamp">SETTLED</div>':''}
<div class="page">
<div class="hdr"><div><div class="logo">V</div></div>
  <div class="shop">Sri Vishnu Madha</div>
  <div class="tagline">Nagai Adagu Kadai &bull; Vaiyampatti Road, Irumathur</div>
  <div class="tagline" style="color: #333; font-weight: 700;">Tel: 7339638249, 8270774080</div>
  <div class="rtitle">${titles[type]}</div>
</div>
<div class="meta">
  <div><div class="ml">Loan No.</div><div class="mv">${loan.id}</div></div>
  ${type === 'payment' && paymentData ? `<div><div class="ml">Payment Ref.</div><div class="mv">${paymentData.paymentId}</div></div>` : ''}
  <div><div class="ml">Loan Date</div><div class="mv">${fmt(loan.date)}</div></div>
  <div><div class="ml">Due Date</div><div class="mv">${fmt(loan.dueDate)}</div></div>
  <div><div class="ml">Status</div><div class="mv"><span class="${loan.status==='Active'?'badge-a':'badge-c'}">${loan.status}</span></div></div>
  <div><div class="ml">Principal</div><div class="mv">${cur(currentPrincipal)}</div></div>
  <div><div class="ml">Interest Due</div><div class="mv">${cur(accrued)}</div></div>
  <div><div class="ml">Outstanding</div><div class="mv">${cur(totalDue)}</div></div>
  <div><div class="ml">Print Date</div><div class="mv">${fmt(today)}</div></div>
</div>
<div class="sec"><div class="sec-title">Customer Details</div><div class="grid2">
  <div class="cell"><div class="cl">Full Name</div><div class="cv">${loan.name}</div></div>
  <div class="cell"><div class="cl">Mobile</div><div class="cv">${loan.phone}</div></div>
</div></div>
<div class="sec"><div class="sec-title">Pledge / Collateral Details</div><div class="grid2">
  <div class="cell"><div class="cl">Ornament Type</div><div class="cv">${loan.ornamentType||'Gold Jewellery'}</div></div>
  <div class="cell"><div class="cl">Purity</div><div class="cv">${loan.purity}</div></div>
  <div class="cell"><div class="cl">Gross Weight</div><div class="cv">${loan.weight} g</div></div>
  <div class="cell"><div class="cl">Stone/Wastage</div><div class="cv">${loan.stoneWastage || 0} g</div></div>
  <div class="cell"><div class="cl">Net Weight</div><div class="cv">${(parseFloat(loan.weight) - parseFloat(loan.stoneWastage || 0)).toFixed(2)} g</div></div>
  <div class="cell"><div class="cl">Interest Rate</div><div class="cv">${loan.interest}% / month</div></div>
</div></div>

${type==='payment' && paymentData ? `
<div class="amt-box">
  <div class="amt-lbl">Interest Payment Received</div>
  <div class="amt-val">${cur(paymentData.amount)}</div>
  <div class="amt-sub">Received on: ${fmt(paymentData.date)} &bull; ${paymentData.description}</div>
</div>
  <div class="sec">
    <div class="sec-title">Payment Summary</div>
    <table class="tbl">
      <tr><td>Loan Principal (Before)</td><td>${cur(loan.amount)}</td></tr>
      <tr><td>Current Balance Due</td><td>${cur(totalDue + (paymentData.amount || 0))}</td></tr>
      <tr><td>Interest Rate</td><td>${loan.interest}% / month</td></tr>
      <tr><td>Payment Date</td><td>${fmt(paymentData.date)}</td></tr>
      <tr class="tr-total"><td>Payment Received</td><td>${cur(paymentData.amount)}</td></tr>
      <tr class="tr-total"><td>New Balance Due</td><td>${cur(totalDue)}</td></tr>
    </table>
  </div>
` : ''}

${type === 'interest' ? `
<div class="sec"><div class="sec-title">Interest Statement &mdash; As of ${fmt(today)}</div>
<table class="tbl">
  <tr><td>Current Principal</td><td>${cur(currentPrincipal)}</td></tr>
  <tr><td>Interest Rate</td><td>${loan.interest}% / month</td></tr>
  <tr><td>Total Interest Accrued</td><td>${cur(accrued)}</td></tr>
  <tr class="tr-total"><td>Net Amount Due to Close</td><td>${cur(totalDue)}</td></tr>
</table></div>
<div class="amt-box"><div class="amt-lbl">Current Balance Due to Close</div>
  <div class="amt-val">${cur(totalDue)}</div>
  <div class="amt-sub">Principal ${cur(currentPrincipal)} + Accrued Interest</div>
</div>` : ''}
${type==='settlement'?`
<div class="sec"><div class="sec-title">Settlement Summary</div>
<table class="tbl">
  <tr><td>Principal Amount</td><td>${cur(loan.amount)}</td></tr>
  <tr><td>Loan Start Date</td><td>${fmt(loan.date)}</td></tr>
  <tr><td>Settlement Date</td><td>${fmt(loan.releasedDate)}</td></tr>
  <tr><td>Interest Rate</td><td>${loan.interest}% / month</td></tr>
  <tr><td>Interest Charged</td><td>${cur(loan.finalInterest)}</td></tr>
  <tr class="tr-total"><td>Total Settled Amount</td><td>${cur(loan.totalPaid)}</td></tr>
</table></div>
<div class="amt-box"><div class="amt-lbl">Total Settlement Amount Received</div>
  <div class="amt-val">${cur(loan.totalPaid)}</div><div class="amt-sub">Gold Released on ${fmt(loan.releasedDate)}</div>
</div>
<div style="text-align:center;margin:16px 0;padding:12px;background:#d1fae5;border-radius:8px">
  <span style="color:#065f46;font-weight:900;font-size:14px;letter-spacing:2px">\u2713 LOAN FULLY SETTLED &mdash; GOLD RELEASED TO CUSTOMER</span>
</div>`:''}
<div class="terms">
  <div class="sec-title" style="margin-bottom:8px">Terms &amp; Conditions</div>
  <p>1. Pledged gold returned only upon full repayment of principal and accrued interest.</p>
  <p>2. Interest at ${loan.interest}% per month on outstanding principal.</p>
  <p>3. Non-payment before due date may lead to forfeiture or legal action.</p>
  <p>4. This receipt is sole valid proof of pledge. Keep it safely.</p>
  <p>5. All disputes subject to local jurisdiction only.</p>
</div>
<div class="sigs">
  <div class="sig"><div class="sig-line">Customer Signature<br/><b>${loan.name}</b></div></div>
  <div class="sig"><div class="sig-line">Authorised Signatory<br/><b>Sri Vishnu Madha Nagai Adagu Kadai</b></div></div>
</div>
<div class="footer">Computer-generated receipt &bull; Sri Vishnu Madha &copy; ${new Date().getFullYear()} &bull; ${loan.id}</div>
</div>
<button class="print-btn" onclick="window.print()">\uD83D\uDDA8\uFE0F Print / Save as PDF</button>
</body></html>`

  const html = type === 'loan' ? loanHtml : otherHtml
  win.document.write(html)
  win.document.close()
}
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('svm_token'))
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [activeTab, setActiveTab] = useState('dashboard')
  const [loans, setLoans] = useState([])
  const [stats, setStats] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [currentLoanForPayment, setCurrentLoanForPayment] = useState(null)
  const [paymentFormData, setPaymentFormData] = useState({ amount: '', description: 'Interest Payment' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    weight: '',
    stoneWastage: '',
    purity: '22K',
    ornamentType: 'Necklace',
    amount: '',
    interest: '2.0',
    date: new Date().toISOString().split('T')[0]
  })

  // Photo State
  const [goldPhoto, setGoldPhoto] = useState(null)
  const [customerPhoto, setCustomerPhoto] = useState(null)

  useEffect(() => {
    if (isLoggedIn) {
      fetchData()
    }
  }, [isLoggedIn])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [loansRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/loans`).catch(e => ({ data: [] })),
        axios.get(`${API_BASE}/stats`).catch(e => ({ data: {} }))
      ])
      setLoans(Array.isArray(loansRes.data) ? loansRes.data : [])
      setStats(statsRes.data || {})
    } catch (err) {
      console.error('Error fetching data:', err)
      setLoans([])
      setStats({})
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await axios.post(`${API_BASE}/loans`, {
        ...formData,
        goldPhoto: goldPhoto || null,
        customerPhoto: customerPhoto || null
      })
      setFormData({
        name: '',
        phone: '',
        weight: '',
        stoneWastage: '',
        purity: '22K',
        ornamentType: 'Necklace',
        amount: '',
        interest: '2.0',
        date: new Date().toISOString().split('T')[0]
      })
      setGoldPhoto(null)
      setCustomerPhoto(null)
      fetchData()
      alert('Loan Created Successfully!')
      setActiveTab('loans')
    } catch (err) {
      alert('Error creating loan: ' + (err.response?.data?.error || err.response?.data?.message || err.message))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePayment = async (e) => {
    e.preventDefault()
    if (!currentLoanForPayment) return
    try {
      await axios.post(`${API_BASE}/loans/${currentLoanForPayment.id}/payments`, paymentFormData)
      setIsPaymentModalOpen(false)
      setPaymentFormData({ amount: '', description: 'Interest Payment' })
      fetchData()
      alert('Interest Payment Recorded!')
    } catch (err) {
      alert('Error recording payment')
    }
  }

  const handleRelease = async (loanId) => {
    if (window.confirm(`Are you sure you want to release loan ${loanId}?`)) {
      try {
        await axios.put(`${API_BASE}/loans/${loanId}/release`)
        fetchData()
        alert('Loan Released Successfully!')
      } catch (err) {
        alert('Error releasing loan')
      }
    }
  }

  const getFilteredLoans = () => {
    const safeLoans = Array.isArray(loans) ? loans : []
    let filtered = [...safeLoans]
    if (selectedCustomer) {
      filtered = filtered.filter(l => l && l.phone === selectedCustomer)
    }
    const currentSearch = (searchTerm || '').toString()
    if (currentSearch) {
      const lowerSearch = currentSearch.toLowerCase()
      filtered = filtered.filter(l => 
        l && (
          (l.id || '').toString().toLowerCase().includes(lowerSearch) || 
          (l.phone || '').toString().includes(currentSearch) ||
          (l.name || '').toString().toLowerCase().includes(lowerSearch)
        )
      )
    }
    return filtered
  }

  const customers = Array.from(new Set((Array.isArray(loans) ? loans : []).map(l => l?.phone).filter(Boolean))).map(phone => {
    const customerLoans = (Array.isArray(loans) ? loans : []).filter(l => l && l.phone === phone)
    return {
      phone,
      name: customerLoans[0]?.name || 'Unknown Customer',
      totalLoans: customerLoans.length,
      totalActiveLoans: customerLoans.filter(l => l && l.status === 'Active').length,
      totalAmount: customerLoans.reduce((sum, l) => sum + (l?.amount || 0), 0)
    }
  })

  const navItems = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'new', label: 'New Loan' },
    { id: 'loans', label: 'Ledger' },
    { id: 'customers', label: 'Customers' },
    { id: 'settings', label: 'Settings' }
  ]

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-bg-main text-slate-100 flex items-center justify-center p-4">
        <div className="bg-bg-surface border border-border-subtle p-8 rounded-3xl w-full max-w-sm shadow-xl text-center">
          <div className="w-24 h-24 bg-bg-surface border-2 border-primary/30 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/10 overflow-hidden group hover:scale-105 transition-transform duration-500">
            <img src="/icon-512.png" alt="Sri Vishnu Madha Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Admin Login</h2>
          <p className="text-slate-500 text-sm mb-6">Sri Vishnu Madha Nagai Adagu Kadai</p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await axios.post(`${API_BASE}/login`, { password: loginPassword });
              if (res.data.success && res.data.token) {
                localStorage.setItem('svm_token', res.data.token);
                setIsLoggedIn(true);
              }
            } catch(err) {
              const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
              alert('Login Failed: ' + errMsg);
            }
          }} className="space-y-4">
            <input type="text" placeholder="Username" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className="w-full bg-slate-900 border border-border-subtle text-white rounded-xl px-5 py-3 outline-none focus:ring-2 focus:ring-primary/20" />
            <input type="password" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full bg-slate-900 border border-border-subtle text-white rounded-xl px-5 py-3 outline-none focus:ring-2 focus:ring-primary/20" />
            <button type="submit" className="w-full bg-primary text-bg-main font-bold py-3 mt-4 rounded-xl hover:brightness-110 transition-all uppercase tracking-widest text-sm shadow-lg shadow-primary/10">Login</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-main text-slate-100 font-sans selection:bg-primary/30 selection:text-white pb-10">
      {/* Navbar */}
      <nav className="bg-bg-main/80 backdrop-blur-md border-b border-border-subtle sticky top-0 z-50 px-4 md:px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-bg-surface border border-primary/20 rounded-xl flex items-center justify-center shadow-lg shadow-primary/10 overflow-hidden group hover:scale-105 transition-all">
            <img src="/icon-192.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight flex flex-col justify-center">
            <span className="leading-none">Sri Vishnu</span>
            <span className="text-[10px] text-primary/80 uppercase tracking-widest mt-1 leading-none font-black">Madha Nagai Adagu Kadai</span>
          </h1>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-border-subtle">
          {navItems.map(tab => (
            <button 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedCustomer(null); }} 
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === tab.id ? 'bg-primary text-bg-main shadow-md shadow-primary/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              {tab.label}
            </button>
          ))}
          <button 
            onClick={() => { localStorage.removeItem('svm_token'); window.location.reload(); }} 
            className="px-5 py-2 rounded-lg text-sm font-semibold text-rose-400 hover:text-white hover:bg-rose-500/10 transition-all ml-2"
          >
            Sign Out
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 text-primary hover:bg-slate-800 rounded-lg transition-colors"
        >
          {isMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
          )}
        </button>
      </nav>

      {/* Mobile Drawer */}
      <div className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMenuOpen(false)}>
        <div className={`absolute right-0 top-0 h-full w-72 bg-bg-surface shadow-2xl p-6 transition-transform duration-300 transform ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`} onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-border-subtle">
             <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Navigation</h2>
             <button onClick={() => setIsMenuOpen(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="space-y-2">
            {navItems.map(tab => (
              <button 
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedCustomer(null); setIsMenuOpen(false); }} 
                className={`w-full text-left px-5 py-4 rounded-xl text-base font-semibold transition-all ${activeTab === tab.id ? 'bg-primary text-bg-main shadow-lg shadow-primary/10' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                {tab.label}
              </button>
            ))}
            <button 
              onClick={() => { localStorage.removeItem('svm_token'); window.location.reload(); }} 
              className="w-full text-left px-5 py-4 rounded-xl text-base font-semibold text-rose-400 hover:bg-rose-500/10 transition-all border-t border-border-subtle mt-4"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <main className="p-4 md:p-12 max-w-7xl mx-auto space-y-8 md:space-y-12">
        {activeTab === 'dashboard' && <Dashboard stats={stats} isLoading={isLoading} />}
        {activeTab === 'new' && (
          <NewLoanForm
            formData={formData}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            goldPhoto={goldPhoto}
            setGoldPhoto={setGoldPhoto}
            customerPhoto={customerPhoto}
            setCustomerPhoto={setCustomerPhoto}
          />
        )}
        {activeTab === 'loans' && (
          <LoanList
            loans={getFilteredLoans()}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onRelease={handleRelease}
            onPrintReceipt={printReceipt}
            selectedCustomer={selectedCustomer}
            onClearFilter={() => setSelectedCustomer(null)}
            isPaymentModalOpen={isPaymentModalOpen}
            setIsPaymentModalOpen={setIsPaymentModalOpen}
            currentLoanForPayment={currentLoanForPayment}
            setCurrentLoanForPayment={setCurrentLoanForPayment}
            paymentFormData={paymentFormData}
            setPaymentFormData={setPaymentFormData}
            onPayment={handlePayment}
          />
        )}
        {activeTab === 'customers' && (
          <CustomerRecords 
            customers={customers} 
            onViewLoans={(phone) => { setSelectedCustomer(phone); setActiveTab('loans'); }} 
          />
        )}
        {activeTab === 'settings' && (
          <SettingsMenu />
        )}
      </main>

      <footer className="py-12 text-center text-slate-500 border-t border-border-subtle mt-12 bg-slate-950/20">
        <p className="text-[10px] uppercase font-bold tracking-[0.2em]">© {new Date().getFullYear()} Sri Vishnu Madha Nagai Adagu Kadai • Vaiyampatti Road</p>
      </footer>
    </div>
  )
}

function Dashboard({ stats, isLoading }) {
  if (isLoading) return <div className="flex justify-center items-center h-64"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>

  const statCards = [
    { title: 'Gold Received', value: stats?.totalGoldReceived || 0, unit: 'g' },
    { title: 'Gold In Store', value: stats?.goldInStore || 0, unit: 'g' },
    { title: 'Gold Released', value: stats?.goldReleased || 0, unit: 'g' },
    { title: 'Shop Revenue', value: `₹${(stats?.totalRevenue || 0).toLocaleString()}`, unit: '' },
    { title: 'Interest Collected', value: `₹${(stats?.totalInterestCollected || 0).toLocaleString()}`, unit: '' }
  ]

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map(item => (
          <div key={item.title} className="bg-bg-surface border border-border-subtle p-6 rounded-2xl hover:border-primary/30 transition-all shadow-sm">
            <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">{item.title}</h3>
            <p className="text-2xl font-bold flex items-baseline gap-1">
              {item.value}
              {item.unit && <span className="text-primary text-xs font-semibold uppercase">{item.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 border border-primary/20 p-8 rounded-3xl shadow-xl relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
              <h4 className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Active Asset Liquidity</h4>
            </div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Total Collateral Value</p>
            <p className="text-white text-5xl md:text-6xl font-bold tracking-tight">
              ₹{parseFloat(stats?.totalActiveLoanAmount || 0).toLocaleString()}
            </p>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
             <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor" className="text-primary"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8l1.46 1.46c-.1.43-.16.88-.16 1.34 0 2.21 1.79 4 4 4s4-1.79 4-4c0-.46-.06-.91-.16-1.34l1.46-1.46c.45.83.7 1.79.7 2.8 0 3.31-2.69 6-6 6zm0-10c-1.1 0-2 .9-2 2 0 .37.1.71.27 1.01l1.72-1.72c-.01-.01-.01-.01 0-.01.01 0 .01.01.01.01l1.72 1.72c.17-.3.27-.64.27-1.01 0-1.1-.9-2-2-2z"/></svg>
          </div>
        </div>

          <div className="flex-1 bg-bg-surface border border-border-subtle p-6 rounded-2xl flex flex-col justify-between">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Total Active Files</p>
            <div className="flex items-end justify-between">
               <p className="text-3xl font-bold text-white">{stats.activeLoansCount}</p>
               <span className="text-[10px] pb-1 font-bold text-slate-600">OF {stats.totalLoans} TOTAL</span>
            </div>
          </div>
          <div className="flex-1 bg-slate-900/40 border border-emerald-500/10 p-6 rounded-2xl flex flex-col justify-between">
            <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest">Settled Records</p>
            <p className="text-3xl font-bold text-emerald-400">{stats.closedLoansCount}</p>
          </div>
        </div>
      </div>
    )
}

function CameraModal({ captureMode, onCapture, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const startCamera = async () => {
      try {
        const facingMode = captureMode === 'user' ? 'user' : 'environment'
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play()
            setReady(true)
          }
        }
      } catch (err) {
        setError('Camera access denied. Please check permissions.')
      }
    }
    startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [captureMode])

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
    onCapture(dataUrl)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-bg-surface border border-border-subtle rounded-3xl overflow-hidden w-full max-w-xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-8 py-5 border-b border-border-subtle">
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Capture Documentation</p>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">✕</button>
        </div>

        <div className="relative bg-black aspect-video flex items-center justify-center">
          {error ? (
            <div className="text-center p-12">
              <p className="text-rose-400 text-sm font-semibold">{error}</p>
            </div>
          ) : (
            <>
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              <video
                ref={videoRef} autoPlay playsInline muted
                className={`w-full h-full object-cover transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
                style={{ transform: captureMode === 'user' ? 'scaleX(-1)' : 'none' }}
              />
            </>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <div className="p-6 bg-slate-900/50 flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all">Cancel</button>
          <button
            onClick={handleCapture} disabled={!ready || !!error}
            className="flex-[2] py-4 rounded-xl bg-primary text-bg-main text-xs font-bold uppercase tracking-widest hover:brightness-110 shadow-lg shadow-primary/10 disabled:opacity-40 transition-all active:scale-95"
          >
            Take Selection
          </button>
        </div>
      </div>
    </div>
  )
}

function PhotoCapture({ label, icon, photo, setPhoto, captureMode }) {
  const uploadRef = useRef(null)
  const [showCamera, setShowCamera] = useState(false)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onloadend = () => setPhoto(reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{label}</label>

      {/* Preview Area */}
      <div className="relative w-full h-48 bg-slate-900 border border-border-subtle rounded-2xl overflow-hidden flex items-center justify-center group">
        {photo ? (
          <>
            <img src={photo} alt={label} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest px-6 py-2 rounded-full hover:bg-rose-600 transition-all shadow-xl"
              >
                Reset Upload
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-700">
            <span className="text-4xl">{icon}</span>
            <p className="text-[10px] font-bold uppercase tracking-widest">Awaiting Asset</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          className="flex items-center justify-center gap-2 bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest py-3.5 rounded-xl hover:bg-primary hover:text-bg-main transition-all active:scale-95"
        >
          📷 Live Capture
        </button>

        <button
          type="button"
          onClick={() => uploadRef.current.click()}
          className="flex items-center justify-center gap-2 bg-slate-800 border border-border-subtle text-slate-300 text-[10px] font-bold uppercase tracking-widest py-3.5 rounded-xl hover:bg-slate-700 transition-all active:scale-95"
        >
          📁 Browse Local
        </button>
      </div>

      <input ref={uploadRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {showCamera && (
        <CameraModal
          captureMode={captureMode}
          onCapture={(dataUrl) => { setPhoto(dataUrl); setShowCamera(false) }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}

function NewLoanForm({ formData, onChange, onSubmit, isSubmitting, goldPhoto, setGoldPhoto, customerPhoto, setCustomerPhoto }) {


  return (
    <div className="max-w-4xl mx-auto bg-bg-surface border border-border-subtle p-8 md:p-12 rounded-[2rem] shadow-xl animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">New Pledge Entry</h2>
        <p className="text-slate-500 text-sm font-medium">Initialize loan terms and document collateral assets</p>
      </div>
      
      <form onSubmit={onSubmit} className="space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
          {[
            { label: 'Customer Name', name: 'name', type: 'text', placeholder: 'Enter full name' },
            { label: 'Mobile Number', name: 'phone', type: 'tel', placeholder: '10-digit mobile' },
            { label: 'Gross Weight (g)', name: 'weight', type: 'number', placeholder: '0.00', step: '0.01' },
            { label: 'Stone/Wastage (g)', name: 'stoneWastage', type: 'number', placeholder: '0.00', step: '0.01' },
            { label: 'Purity Level', name: 'purity', type: 'select', options: ['22K', '24K', '18K'] },
            { label: 'Required Loan Amount (₹)', name: 'amount', type: 'number', placeholder: 'Loan amount' },
            { label: 'Interest Rate %', name: 'interest', type: 'number', placeholder: '2.0', step: '0.1' },
            { label: 'Pledge Date', name: 'date', type: 'date', span: true },
          ].map(field => (
            <div key={field.name} className={`space-y-2 ${field.span ? 'md:col-span-2' : ''}`}>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  name={field.name} value={formData[field.name]} onChange={onChange}
                  className="w-full bg-slate-900 border border-border-subtle text-white rounded-xl px-5 py-4 focus:ring-2 focus:ring-primary/20 outline-none hover:border-slate-700 transition-all font-medium appearance-none"
                >
                  {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  required type={field.type} name={field.name} value={formData[field.name]} onChange={onChange} step={field.step}
                  placeholder={field.placeholder}
                  className="w-full bg-slate-900 border border-border-subtle text-white rounded-xl px-5 py-4 focus:ring-2 focus:ring-primary/20 outline-none hover:border-slate-700 transition-all placeholder:text-slate-700 font-medium"
                />
              )}
            </div>
          ))}
        </div>

        {/* Ornament Type Picker */}
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Asset Classification</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {[
              { value: 'Necklace',   emoji: '📿' }, { value: 'Chain',      emoji: '⛓️' },
              { value: 'Bangle',     emoji: '🔵' }, { value: 'Ring',       emoji: '💍' },
              { value: 'Earring',    emoji: '✨' }, { value: 'Jhumka',     emoji: '🔔' },
              { value: 'Anklet',     emoji: '🦶' }, { value: 'Bracelet',   emoji: '📿' },
              { value: 'Nose Ring',  emoji: '💎' }, { value: 'Pendant',    emoji: '🏅' },
              { value: 'Waist Belt', emoji: '🌟' }, { value: 'Toe Ring',   emoji: '💠' },
              { value: 'Coin',       emoji: '🪙' }, { value: 'Other',      emoji: '🔶' },
            ].map(({ value, emoji }) => (
              <button
                key={value} type="button"
                onClick={() => onChange({ target: { name: 'ornamentType', value } })}
                className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-[10px] font-bold uppercase transition-all active:scale-95 ${
                  formData.ornamentType === value
                    ? 'bg-primary/10 text-primary border-primary shadow-lg shadow-primary/5'
                    : 'bg-slate-900 border-border-subtle text-slate-500 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <span className="text-xl">{emoji}</span>
                <span className="leading-tight">{value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Photo Documentation Section */}
        <div className="pt-8 border-t border-border-subtle">
          <div className="mb-6">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Visual Documentation</p>
            <p className="text-slate-500 text-xs">Capture mandatory evidence of collateral and client</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <PhotoCapture
              label="Collateral Item" icon="💍" photo={goldPhoto} setPhoto={setGoldPhoto} captureMode="environment"
            />
            <PhotoCapture
              label="Client Identity" icon="👤" photo={customerPhoto} setPhoto={setCustomerPhoto} captureMode="user"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full font-bold py-5 rounded-2xl transition-all active:scale-[0.98] shadow-xl uppercase tracking-widest text-sm mt-4 ${isSubmitting ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-primary text-bg-main hover:brightness-110 shadow-primary/10'}`}
        >
          {isSubmitting ? 'Processing Entry...' : 'Finalize & Issue Loan'}
        </button>
      </form>
    </div>
  )
}

function LoanList({ loans, searchTerm, setSearchTerm, onRelease, onPrintReceipt, selectedCustomer, onClearFilter, isPaymentModalOpen, setIsPaymentModalOpen, currentLoanForPayment, setCurrentLoanForPayment, paymentFormData, setPaymentFormData, onPayment }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-white tracking-tight">Pledge Ledger</h2>
          <p className="text-slate-500 text-sm font-medium">{selectedCustomer ? 'Filtered Records' : 'Asset lifecycle management'}</p>
          {selectedCustomer && (
            <button onClick={onClearFilter} className="mt-4 text-[10px] font-bold text-primary uppercase tracking-widest border border-primary/20 px-4 py-2 rounded-full hover:bg-primary/10 flex items-center gap-2 transition-all">
              <span>✕</span> Clear Filter
            </button>
          )}
        </div>
        <div className="relative w-full lg:w-96">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input 
            type="text" 
            placeholder="Search by ID, Name or Phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-border-subtle text-white rounded-xl pl-11 pr-6 py-4 outline-none focus:ring-2 focus:ring-primary/20 font-medium placeholder:text-slate-700"
          />
        </div>
      </div>

      <div className="space-y-3">
        {/* Table Header (Desktop) */}
        <div className="hidden lg:grid grid-cols-8 gap-4 px-8 py-3 bg-slate-900/50 rounded-xl border border-border-subtle text-[10px] font-bold text-slate-500 uppercase tracking-widest">
           <div>Identity</div>
           <div>Collateral</div>
           <div>Terms</div>
           <div>Principal</div>
           <div>Interest</div>
           <div>Outstanding</div>
           <div>Status</div>
           <div className="text-right">Actions</div>
        </div>

        {/* Loan Records */}
        {Array.isArray(loans) && loans.length > 0 ? loans.map(loan => (
          <div key={loan.id} className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden hover:border-slate-700 transition-all group">
            {/* Mobile View */}
            <div className="lg:hidden p-6 space-y-6">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-primary text-[10px] font-bold uppercase tracking-widest mb-1">{loan.id}</p>
                    <h4 className="text-white font-bold text-lg">{loan.name}</h4>
                    <p className="text-slate-500 text-sm font-medium">{loan.phone}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${loan.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : 'bg-slate-800 text-slate-500'}`}>
                    {loan.status}
                  </span>
               </div>

                <div className="grid grid-cols-2 gap-4 pb-6 border-b border-border-subtle">
                   <div>
                     <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Net weight</p>
                     <p className="font-semibold text-slate-200">{(parseFloat(loan.weight) - parseFloat(loan.stoneWastage || 0)).toFixed(2)}g <span className="text-slate-500 text-xs font-normal">{loan.purity}</span></p>
                     <span className="text-[9px] text-slate-400">{loan.ornamentType || 'Item'} (Gr: {loan.weight}g)</span>
                   </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Interest</p>
                    <p className="font-semibold text-slate-200">{loan.interest}%</p>
                    <p className="text-[9px] text-slate-400">Monthly</p>
                  </div>
               </div>

               <div className="flex justify-between items-center bg-slate-900/30 p-4 rounded-xl">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Principal</p>
                    <p className="text-lg font-bold text-white">₹{getLoanState(loan).currentPrincipal.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Outstanding</p>
                    <p className="text-lg font-bold text-emerald-400">₹{getLoanState(loan).outstanding.toLocaleString()}</p>
                  </div>
               </div>
               
               <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest px-1">
                  <span className="text-slate-500">Interest Accrued: <span className="text-orange-400">₹{getLoanState(loan).interestDue.toLocaleString()}</span></span>
                  {loan.status === 'Active' ? (
                       <button onClick={() => onRelease(loan.id)} className="bg-primary text-bg-main px-6 py-2.5 rounded-xl shadow-lg shadow-primary/10">Release</button>
                    ) : (
                       <span className="text-slate-600 italic">Settled</span>
                    )}
               </div>
               
               {/* Quick Receipts - Mobile */}
               <div className="grid grid-cols-3 gap-2">
                 <button onClick={() => onPrintReceipt(loan, 'loan')} className="flex flex-col items-center gap-1 p-3 bg-slate-900 rounded-xl hover:bg-slate-800 text-slate-400 transition-all border border-border-subtle">
                    <span className="text-xs">🧾</span>
                    <span className="text-[8px] font-bold uppercase">Loan</span>
                 </button>
                 <button onClick={() => onPrintReceipt(loan, 'interest')} className="flex flex-col items-center gap-1 p-3 bg-slate-900 rounded-xl hover:bg-slate-800 text-slate-400 transition-all border border-border-subtle">
                    <span className="text-xs">📊</span>
                    <span className="text-[8px] font-bold uppercase">Stats</span>
                 </button>
                 {loan.status === 'Closed' && (
                   <button onClick={() => onPrintReceipt(loan, 'settlement')} className="flex flex-col items-center gap-1 p-3 bg-emerald-900/20 rounded-xl text-emerald-500 border border-emerald-500/10">
                      <span className="text-xs">✅</span>
                      <span className="text-[8px] font-bold uppercase">Record</span>
                   </button>
                 )}
               </div>
            </div>

            {/* Desktop View */}
            <div className="hidden lg:grid grid-cols-8 gap-4 px-8 py-5 items-center">
               <div>
                  <p className="text-primary text-[10px] font-bold tracking-widest mb-0.5">{loan.id}</p>
                  <p className="text-white font-bold">{loan.name}</p>
                  <p className="text-slate-500 text-[10px]">{loan.phone}</p>
               </div>
                <div className="space-y-1">
                   <p className="text-slate-200 font-semibold">{(parseFloat(loan.weight) - parseFloat(loan.stoneWastage || 0)).toFixed(2)}g <span className="text-slate-500 text-xs font-normal">{loan.purity}</span></p>
                   <span className="text-[10px] text-slate-500">{loan.ornamentType} (Gr: {loan.weight}g)</span>
                </div>
               <div>
                  <p className="text-slate-200 font-semibold">{loan.interest}%</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Interest</p>
               </div>
               <div className="text-white font-bold">₹{getLoanState(loan).currentPrincipal.toLocaleString()}</div>
               <div className="text-orange-400 font-bold">₹{getLoanState(loan).interestDue.toLocaleString()}</div>
               <div className="text-emerald-400 font-bold text-lg">₹{getLoanState(loan).outstanding.toLocaleString()}</div>
               <div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${loan.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : 'bg-slate-800 text-slate-500'}`}>
                    <span className={`w-1 h-1 rounded-full ${loan.status === 'Active' ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                    {loan.status}
                  </span>
               </div>
               <div className="flex justify-end gap-1.5">
                  {loan.status === 'Active' && (
                    <button onClick={() => { setCurrentLoanForPayment(loan); setIsPaymentModalOpen(true); }} title="Record Payment" className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-bg-main transition-all">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zM12 4v16m8-8H4" /></svg>
                    </button>
                  )}
                  <button onClick={() => onPrintReceipt(loan, 'loan')} title="Print Receipt" className="p-2 bg-slate-800 text-slate-400 border border-border-subtle rounded-lg hover:text-white transition-all">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  </button>
                  {loan.status === 'Active' && (
                    <button onClick={() => onRelease(loan.id)} title="Release Asset" className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 rounded-lg hover:bg-emerald-500 hover:text-white transition-all">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </button>
                  )}
               </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-24 bg-bg-surface border border-border-subtle rounded-3xl">
             <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border-subtle">
                <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
             </div>
             <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No records matching your search</p>
          </div>
        )}
      </div>

      {isPaymentModalOpen && currentLoanForPayment && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" onClick={() => setIsPaymentModalOpen(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md shadow-2xl p-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
               <div>
                  <h3 className="text-xl font-black text-white">Record Payment</h3>
                  <p className="text-gold-primary text-[10px] font-black uppercase tracking-widest">{currentLoanForPayment.id} • {currentLoanForPayment.name}</p>
               </div>
               <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>
            
            <form onSubmit={onPayment} className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Payment Amount (₹)</label>
                  <input 
                    required type="number" 
                    value={paymentFormData.amount} 
                    onChange={e => setPaymentFormData({...paymentFormData, amount: e.target.value})}
                    placeholder="Enter Interest Amount"
                    className="w-full bg-black border border-gray-800 text-gold-primary text-2xl font-black rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-gold-primary/30"
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Description / Remarks</label>
                  <input 
                    type="text" 
                    value={paymentFormData.description}
                    onChange={e => setPaymentFormData({...paymentFormData, description: e.target.value})}
                    className="w-full bg-black border border-gray-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-gold-primary/30 font-bold text-sm"
                  />
               </div>
               <button type="submit" className="w-full bg-gold-primary text-black font-black py-4 rounded-2xl shadow-xl shadow-gold-primary/20 uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all mt-4">
                  Confirm Payment
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomerRecords({ customers, onViewLoans }) {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-white tracking-tight">Client Hub</h2>
          <p className="text-slate-500 text-sm font-medium">Unified management of client loan profiles</p>
        </div>
        <div className="bg-slate-900 border border-border-subtle rounded-xl px-5 py-3 flex items-center gap-6">
           <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Active Clients: <span className="text-primary ml-1">{customers?.length || 0}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.isArray(customers) && customers.map(c => (
           <div key={c.phone} className="bg-bg-surface border border-border-subtle p-8 rounded-3xl hover:border-slate-700 transition-all shadow-sm group">
              <div className="flex justify-between items-start mb-8">
                 <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center font-bold text-primary text-2xl border border-border-subtle shadow-inner">
                    {c.name ? c.name.charAt(0) : '?'}
                 </div>
                 <div className="text-right">
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Active Assets</p>
                    <p className="text-2xl font-bold text-emerald-400">{c.totalActiveLoans}</p>
                 </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-0.5 truncate">{c.name}</h3>
                <p className="text-slate-500 font-medium text-sm">{c.phone}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-5 rounded-2xl mb-8 border border-border-subtle">
                 <div>
                    <p className="text-[8px] font-bold text-slate-600 uppercase mb-1">Total Files</p>
                    <p className="font-bold text-slate-300 text-sm">{c.totalLoans}</p>
                 </div>
                 <div>
                    <p className="text-[8px] font-bold text-slate-600 uppercase mb-1">Aggregate Value</p>
                    <p className="font-bold text-primary text-sm">₹{c.totalAmount.toLocaleString()}</p>
                 </div>
              </div>

              <button 
                onClick={() => onViewLoans(c.phone)}
                className="w-full bg-slate-800 text-slate-300 hover:bg-primary hover:text-bg-main py-4 rounded-xl font-bold uppercase text-[10px] tracking-[0.1em] transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                View History <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </button>
           </div>
        ))}
      </div>
    </div>
  )
}

function SettingsMenu() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');



  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    try {
       const res = await axios.post(`${API_BASE}/settings`, { currentPassword, newPassword });
       if (res.data.success) {
          alert('Password updated successfully!');
          setCurrentPassword('');
          setNewPassword('');
       }
    } catch(err) {
       alert(err.response?.data?.message || 'Error updating password');
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      


      {/* Password Section */}
      <div className="bg-bg-surface border border-border-subtle p-8 rounded-[2rem] shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-6">Change Security Password</h2>
        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-sm">
           <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Current Password</label>
              <input required type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className="w-full bg-slate-900 border border-border-subtle text-white rounded-xl px-5 py-3 outline-none focus:ring-2 focus:ring-primary/20 mt-1" />
           </div>
           <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">New Password</label>
              <input required type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="w-full bg-slate-900 border border-border-subtle text-white rounded-xl px-5 py-3 outline-none focus:ring-2 focus:ring-primary/20 mt-1" />
           </div>
           <button type="submit" className="bg-primary text-bg-main font-bold py-3 px-8 rounded-xl hover:brightness-110 transition-all uppercase tracking-widest text-xs shadow-lg shadow-primary/10">Change Password</button>
        </form>
      </div>

    </div>
  )
}

export default App
