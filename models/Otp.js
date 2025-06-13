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
    subject: 'Your OTP Code',
    html: `<p>Your OTP code is <strong>${otp}</strong>. It will expire in 10 minutes.</p>`
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
