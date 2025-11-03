import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sns = new SNSClient({ region: "us-east-1" });

export const handler = async (event) => {
    
    // event will contain: type, sender, receiver, postId, commentText etc.
    const { type, sender, receiver, postId, commentText } = event;

    let message = "";

    if (type === "like") {
        message = `${sender} liked your post #${postId}`;
    }
    else if (type === "comment") {
        message = `${sender} commented "${commentText}" on your post`;
    }
    else if (type === "follow") {
        message = `${sender} started following you`;
    }

    const params = {
        TopicArn: "arn:aws:sns:us-east-1:your_aws_id:notifications-topic",
        Message: message
    };

    await sns.send(new PublishCommand(params));

    return { statusCode: 200, body: "Notification Sent ✅" };
};

