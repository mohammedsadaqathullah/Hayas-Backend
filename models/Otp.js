const nodemailer = require('nodemailer');

const otpStore = {}; // In production, use Redis or a database

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmailOTP(email) {
  const otp = generateOTP();
  otpStore[email] = {
    otp,
    expires: Date.now() + 10 * 60 * 1000 // 10-minute expiry
  };

  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: 'hayasfastdelivery@gmail.com',
      pass: 'iuwt acnx qhfc wgpo' // App password
    }
  });

 const mailOptions = {
  from: `HAYAS Fast Delivery <hayasfastdelivery@gmail.com>`,
  to: email,
  subject: 'Your One-Time Password (OTP)',
  html: `
    <div style="font-family: 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f4; padding: 30px 0;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Header / Banner -->
        <img src="https://yourdomain.com/banner.jpg" alt="HAYAS Banner" style="width: 100%; display: block;"/>

        <!-- Content -->
        <div style="padding: 30px 20px; text-align: center;">
          <h2 style="margin-top: 0; color: #222;">Your Verification Code</h2>
          <p style="font-size: 16px; color: #555;">
            Hello,
            <br/><br/>
            Use the following OTP to verify your email address with <strong>HAYAS Fast Delivery</strong>. 
            This code is valid for the next <strong>10 minutes</strong>.
          </p>

          <!-- OTP Display -->
          <div style="margin: 30px 0;">
            <div style="display: inline-block; background-color: #f0f0f0; padding: 15px 30px; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #333;">
              ${otp}
            </div>
          </div>

          <p style="font-size: 14px; color: #999;">
            If you did not request this, you can safely ignore this email.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #fafafa; padding: 15px 20px; text-align: center; font-size: 12px; color: #aaa;">
          &copy; ${new Date().getFullYear()} HAYAS Fast Delivery. All rights reserved.
        </div>
      </div>
    </div>
  `
};

  try {
    await transporter.verify();
    console.log('Transporter verified, ready to send emails.');
    await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully.');
    return true;
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    throw error;
  }
}

// Verify OTP
function verifyOTP(email, inputOtp) {
  const record = otpStore[email];
  if (!record) return false;

  // Check if expired
  if (Date.now() > record.expires) {
    delete otpStore[email];
    return false;
  }

  const isValid = record.otp === inputOtp;
  if (isValid) delete otpStore[email]; // Clean up used OTP
  return isValid;
}
module.exports = { sendEmailOTP, verifyOTP };
