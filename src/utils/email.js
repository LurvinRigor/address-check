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
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
                    <h2 style="color: #2c3e50; margin-bottom: 20px;">Address Verification Required</h2>
                    <p style="color: #34495e; line-height: 1.6;">
                        We have received your address information and need to verify it. Please click the button below to confirm your current address:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationUrl}" 
                           style="background-color: #3498db; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Verify My Address
                        </a>
                    </div>
                    <p style="color: #7f8c8d; font-size: 14px;">
                        If the button above doesn't work, you can also copy and paste this link into your browser:
                        <br>
                        <span style="color: #34495e;">${verificationUrl}</span>
                    </p>
                </div>
                <p style="color: #7f8c8d; font-size: 12px; text-align: center;">
                    This is an automated message. Please do not reply to this email.
                </p>
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

async function sendAddressChangeNotification(email, oldAddress, newAddress) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: 'Address Change Notification - Action Required',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
                    <h2 style="color: #856404; margin-bottom: 20px;">Address Change Detected</h2>
                    <p style="color: #664d03; line-height: 1.6;">
                        A user has updated their address information. Please review the changes below:
                    </p>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
                    <p><strong>User Email:</strong> ${email}</p>
                    <div style="margin: 20px 0; padding: 15px; background-color: #e9ecef; border-radius: 5px;">
                        <p style="margin: 0;"><strong>Previous Address:</strong></p>
                        <p style="margin: 10px 0 0 0; color: #dc3545;">${oldAddress}</p>
                    </div>
                    <div style="margin: 20px 0; padding: 15px; background-color: #e9ecef; border-radius: 5px;">
                        <p style="margin: 0;"><strong>New Address:</strong></p>
                        <p style="margin: 10px 0 0 0; color: #28a745;">${newAddress}</p>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                    <a href="${process.env.BASE_URL || 'http://localhost:3000'}/admin/users" 
                       style="background-color: #28a745; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        View User Details
                    </a>
                </div>

                <p style="color: #7f8c8d; font-size: 12px; text-align: center; margin-top: 30px;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Email sending failed:', error);
        throw error;
    }
}

module.exports = {
    sendVerificationEmail,
    sendAddressChangeNotification
}; 