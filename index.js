//Configuration
const REGION = "us-east-1";
const STORAGE_BUCKET = "andy-mail-test";
const DB_TABLE_NAME = "Attachement";

//Do not edit below this line
var AWS = require('aws-sdk');
const { v4: uuidv4 } = require("uuid");    
const simpleParser = require('mailparser').simpleParser;
var fs = require("fs");
AWS.config.update({region: REGION});

const s3Client = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg"];

processAttachment = async (emailId, from, to, attachement) => {
  return new Promise(async (resolve, reject) => {

    if(allowedMimeTypes.includes(attachement.contentType)){
      console.log("Processing: ",attachement.filename);
  
      //Save to tmp
      var destination = emailId +"."+attachement.filename;
  
      //Transfer to s3
      const upload = await s3Client.putObject({
        Bucket: STORAGE_BUCKET,
        Key: "saved-attachements/"+destination,
        Body: attachement.content
      });

      const result = await upload.promise();
      saveToDb(emailId, from, to, destination);
      resolve(result);
    }else{
      //Skip file
      console.log("Skipping: ",attachement.filename);
    }

  });
}

saveToDb = (emailId, from, to, filepath) => {

  //Save to dynamoDB table
  var item = {
    "id": uuidv4(),
    "unqiue_email_id": emailId,
    "from": from,
    "to" : to,
    "filepath": filepath
  }
  
  dynamodb.put({
    TableName: DB_TABLE_NAME,
    Item: item
  }, function(err,data) {
    if(err){
      console.log("err",err);
    }
    else{
      console.log("data",data)
    }
  });

}

app =  async (event) => {
  const bucketName = event['Records'][0]['s3']['bucket']['name'];
  const objectKey = event['Records'][0]['s3']['object']['key'];

  var getParams = {
    Bucket: bucketName, 
    Key: objectKey 
  };
  const data = await s3Client.getObject(getParams);
  let objectData = await data.promise();
  let emailData  = objectData.Body.toString('utf-8');

  let parsed = await simpleParser(emailData);
  let attachements = parsed.attachments;
  let emailId = (Math.floor(Date.now() / 1000));
  
  for (let index = 0; index < attachements.length; index++) {
    var attachement = attachements[index];

    const result = await processAttachment(emailId, parsed.from.text, parsed.to.text, attachement);
    console.log(result);
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify('Yay from Lambda!'),
  };
  return response;
};


exports.handler = app;