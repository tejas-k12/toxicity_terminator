// notificationService.js
import AWS from "aws-sdk";

// ✅ set your region
AWS.config.update({ region: "us-east-1" });

const sns = new AWS.SNS();

export async function sendNotification(eventBody) {
    try {
        const message = `
New Notification:
Type: ${eventBody.type}
From: ${eventBody.sender}
To: ${eventBody.receiver}
Post ID: ${eventBody.postId}
        `;

        const params = {
            TopicArn: "arn:aws:sns:ap-south-1:YOUR_AWS_ID:notifications-topic",
            Subject: "New Notification",
            Message: message
        };

        console.log("📨 Sending SNS Email:", params);

        const response = await sns.publish(params).promise();

        console.log("✅ SNS Response:", response);
        return response;

    } catch (err) {
        console.error("❌ SNS Error:", err);
        throw err;
    }
}
