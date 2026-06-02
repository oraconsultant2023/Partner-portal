import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  try {
    const body = await request.json();
    const { customerId, campaignName, status, startDate, endDate, fileName, fileData, mimeType } = body;

    // --- STEP 1: Request Staged Upload Target ---
    const stagedUploadRes = await admin.graphql(
      `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters { name value }
          }
        }
      }`,
      {
        variables: {
          input: [{ filename: fileName, mimeType: mimeType, resource: "FILE", httpMethod: "POST" }]
        }
      }
    );

    const stagedData = await stagedUploadRes.json();
    const target = stagedData.data.stagedUploadsCreate.stagedTargets[0];

    // --- STEP 2: Upload File to Shopify Staging URL ---
    const fileBuffer = Buffer.from(fileData, 'base64');
    const uploadFormData = new FormData();
    
    // Type the parameter to satisfy TS
    target.parameters.forEach((param: { name: string; value: string }) => {
      uploadFormData.append(param.name, param.value);
    });
    
    const blob = new Blob([fileBuffer], { type: mimeType });
    uploadFormData.append("file", blob, fileName);

    const uploadResponse = await fetch(target.url, {
      method: 'POST',
      body: uploadFormData
    });

    if (!uploadResponse.ok) throw new Error("Failed to upload file to Shopify staging");

    // --- STEP 3: Register File in Shopify ---
    const fileCreateRes = await admin.graphql(
      `mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files { id }
        }
      }`,
      {
        variables: {
          files: [{ originalSource: target.resourceUrl, contentType: "FILE" }]
        }
      }
    );
    const fileCreateData = await fileCreateRes.json();
    const shopifyFileId = fileCreateData.data.fileCreate.files[0].id;

    // --- STEP 4: Create Campaign Metaobject ---
    const metaobjectRes = await admin.graphql(
      `mutation CreateCampaign($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
        }
      }`,
      {
        variables: {
          metaobject: {
            type: "partner_campaign",
            fields: [
              { key: "campaign_name", value: campaignName },
              { key: "status", value: status },
              { key: "start_date", value: startDate },
              { key: "end_date", value: endDate || null },
              { key: "invoice_pdf", value: shopifyFileId }
            ]
          }
        }
      }
    );
    const metaobjectData = await metaobjectRes.json();
    const newMetaobjectId = metaobjectData.data.metaobjectCreate.metaobject.id;

    // --- STEP 5: Attach Metaobject to Customer ---
    const customerQueryRes = await admin.graphql(
      `query getCustomerMetafields($id: ID!) {
        customer(id: $id) {
          metafield(namespace: "custom", key: "partner_campaigns") { value }
        }
      }`,
      { variables: { id: customerId } }
    );
    const customerData = await customerQueryRes.json();
    
    let existingCampaigns: string[] = [];
    const existingMetafieldValue = customerData.data.customer.metafield?.value;
    
    if (existingMetafieldValue) {
       existingCampaigns = JSON.parse(existingMetafieldValue); 
    }
    
    existingCampaigns.push(newMetaobjectId);

    await admin.graphql(
      `mutation updateCustomerMetafield($input: CustomerInput!) {
        customerUpdate(input: $input) {
          userErrors { message }
        }
      }`,
      {
        variables: {
          input: {
            id: customerId,
            metafields: [
              {
                namespace: "custom",
                key: "partner_campaigns",
                type: "list.metaobject_reference",
                value: JSON.stringify(existingCampaigns)
              }
            ]
          }
        }
      }
    );

    return json({ success: true, message: "Campaign created and linked" });

  } catch (error: any) {
    console.error("CAMPAIGN CREATION ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}