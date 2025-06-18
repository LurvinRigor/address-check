const nodemailer = require('nodemailer');

// Create a transporter using Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Verify transporter configuration
transporter.verify(function(error, success) {
    if (error) {
        console.log('Transporter verification error:', error);
    } else {
        console.log('Transporter is ready to send emails');
    }
});

// Function to send verification email
async function sendVerificationEmail(email, token) {
    const verificationUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/verify/${token}`;
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Please Verify Your Address Information',
        html: `
            <div style="padding: 0; margin: 0; font-family: 'Segoe UI', Arial, sans-serif;">
                <div style="max-width: 600px; margin: 40px auto; background: #e2f5ff; border-radius: 16px; box-shadow: 0 4px 24px rgba(44, 62, 80, 0.08); overflow: hidden;">
                    <div style="padding: 32px 32px 20px 32px; text-align: center; color: black;">
                        <h2 style="margin: 0 0 8px 0; font-size: 1.7rem; font-weight: 700;">Address Verification Required</h2>
                        <p style="margin: 0; font-size: 1.08rem; color: black;">
                            We have received your address information and need to verify it. <br>
                            Please click the button below to confirm your current address:
                        </p>
                    </div>
                    <div style="padding: 10px 32px;">
                        <div style="text-align: center;">
                            <a href="${verificationUrl}" 
                               style="background: linear-gradient(to right, #2463ea 0%, #06b5d4 100%); color: #fff; padding: 14px 36px; border-radius: 8px; font-size: 1.1rem; font-weight: 600; text-decoration: none; box-shadow: 0 2px 8px rgba(67,160,71,0.08); transition: background 0.2s; display: inline-block;">
                                Verify My Address
                            </a>
                        </div>
                        <p style="color: black; font-size: 14px;">
                            If the button above doesn't work, you can also copy and paste this link into your browser:
                            <br>
                            <span style="color: #34495e;">${verificationUrl}</span>
                        </p>
                    </div>
                    <div style="padding: 18px 32px 24px 32px; text-align: center; color: #6b6969; font-size: 0.98rem;">
                        This is an automated message. Please do not reply to this email.
                    </div>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Email sending error:', error);
        throw new Error('Failed to send verification email');
    }
}

async function sendImportCompletionNotification(stats) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: 'User Import Completed - Summary Report',
        html: `
            <div style="padding: 0; margin: 0; font-family: 'Segoe UI', Arial, sans-serif;">
                <div style="max-width: 520px; margin: 40px auto; background: #e2f5ff; border-radius: 16px; box-shadow: 0 4px 24px rgba(44, 62, 80, 0.08); overflow: hidden;">
                    <div style="padding: 32px 32px 20px 32px; text-align: center; color: black;">
                        <div style="font-size: 48px; margin-bottom: 12px;">
                            <span style="display: inline-block; background: #2463ea; color: #fff; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 32px;">&#10003;</span>
                        </div>
                        <h2 style="margin: 0 0 8px 0; font-size: 1.7rem; font-weight: 700;">Import Process Completed</h2>
                        <p style="margin: 0; font-size: 1.08rem;">The user import process has been completed successfully. Here's a summary of the results:</p>
                    </div>
                    <div style="padding: 10px 32px;">
                        <div style="background: #c4e8fc; border-radius: 10px; box-shadow: 0 1px 4px rgba(44, 62, 80, 0.04); padding: 24px 20px; margin-bottom: 24px;">
                            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                                <span style="display: inline-block; width: 10px; height: 10px; background: #43a047; border-radius: 50%; margin-right: 12px; margin-top:5px;"></span>
                                <span style="font-weight: 600; color: #222;">New Users Added:</span>
                                <span style="margin-left: auto; color: #43a047; font-weight: 700;">${stats.insertedCount}</span>
                            </div>
                            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                                <span style="display: inline-block; width: 10px; height: 10px; background: #1976d2; border-radius: 50%; margin-right: 12px; margin-top:5px;"></span>
                                <span style="font-weight: 600; color: #222;">Users Updated:</span>
                                <span style="margin-left: auto; color: #1976d2; font-weight: 700;">${stats.updatedCount}</span>
                            </div>
                            <div style="display: flex; align-items: center;">
                                <span style="display: inline-block; width: 10px; height: 10px; background: #bdbdbd; border-radius: 50%; margin-right: 12px; margin-top:5px;"></span>
                                <span style="font-weight: 600; color: #222;">Users Skipped (No Changes):</span>
                                <span style="margin-left: auto; color: #757575; font-weight: 700;">${stats.skippedCount}</span>
                            </div>
                        </div>
                        <div style="text-align: center; margin: 32px 0 0 0;">
                            <a href="${process.env.BASE_URL || 'http://localhost:3000'}/dashboard" 
                               style="background: linear-gradient(to right, #2463ea 0%, #06b5d4 100%); color: #fff; padding: 14px 36px; border-radius: 8px; font-size: 1.1rem; font-weight: 600; text-decoration: none; box-shadow: 0 2px 8px rgba(67,160,71,0.08); transition: background 0.2s; display: inline-block;">
                                Go To Dashboard
                            </a>
                        </div>
                    </div>
                    <div style="padding: 18px 32px 24px 32px; text-align: center; color: #6b6969; font-size: 0.98rem;">
                        This is an automated message. Please do not reply to this email.
                    </div>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Import completion email sending failed:', error);
        throw error;
    }
}

module.exports = {
    sendVerificationEmail,
    sendImportCompletionNotification
}; 