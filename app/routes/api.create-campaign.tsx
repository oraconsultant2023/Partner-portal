import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  try {
    const body = await request.json();
    const { customerId, campaignName, status, startDate, endDate, fileName, fileData, mimeType } = body;

    // --- SAFETY CHECK: Ensure Customer ID exists ---
    if (!customerId) {
      return json({ success: false, error: "Missing Customer ID. Please select a partner from the dropdown." }, { status: 400 });
    }

    // Shopify requires the full global ID format. This safely handles both "12345" and "gid://shopify/Customer/12345"
    const formattedCustomerId = customerId.includes("gid://") ? customerId : `gid://shopify/Customer/${customerId}`;

    // --- Format Dates for Shopify ---
    const formattedStartDate = startDate ? `${startDate}T00:00:00` : null;
    const formattedEndDate = endDate ? `${endDate}T00:00:00` : null;

    // --- STEP 1: Request Staged Upload Target ---
    const stagedUploadRes = await admin.graphql(
      `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters { name value }
          }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: [{ filename: fileName, mimeType: mimeType, resource: "FILE", httpMethod: "POST" }]
        }
      }
    );

    const stagedData = await stagedUploadRes.json();
    const stagedErrors = stagedData.data?.stagedUploadsCreate?.userErrors || [];
    if (stagedErrors.length > 0) {
      return json({ success: false, error: `Staged Upload Error: ${stagedErrors[0].message}` }, { status: 400 });
    }

    const target = stagedData.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) return json({ success: false, error: "Failed to generate file upload target from Shopify." }, { status: 400 });

    // --- STEP 2: Upload File to Shopify Staging URL ---
    const fileBuffer = Buffer.from(fileData, 'base64');
    const uploadFormData = new FormData();
    
    target.parameters.forEach((param: { name: string; value: string }) => {
      uploadFormData.append(param.name, param.value);
    });
    
    const blob = new Blob([fileBuffer], { type: mimeType });
    uploadFormData.append("file", blob, fileName);

    const uploadResponse = await fetch(target.url, {
      method: 'POST',
      body: uploadFormData
    });

    if (!uploadResponse.ok) throw new Error("Failed to stream file data to Shopify staging servers.");

    // --- STEP 3: Register File in Shopify ---
    const fileCreateRes = await admin.graphql(
      `mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          files: [{ originalSource: target.resourceUrl, contentType: "FILE" }]
        }
      }
    );
    const fileCreateData = await fileCreateRes.json();
    const fileErrors = fileCreateData.data?.fileCreate?.userErrors || [];
    if (fileErrors.length > 0) {
      return json({ success: false, error: `File Registration Error: ${fileErrors[0].message}` }, { status: 400 });
    }

    const shopifyFileId = fileCreateData.data?.fileCreate?.files?.[0]?.id;
    if (!shopifyFileId) return json({ success: false, error: "Shopify did not return a valid File ID." }, { status: 400 });

    // --- STEP 4: Create Campaign Metaobject ---
    const metaobjectRes = await admin.graphql(
      `mutation CreateCampaign($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          metaobject: {
            type: "partner_campaign",
            status: "ACTIVE", // <--- This forces it to be published immediately
            fields: [
              { key: "campaign_name", value: campaignName },
              { key: "status", value: status },
              { key: "start_date", value: formattedStartDate },
              { key: "end_date", value: formattedEndDate },
              { key: "invoice_pdf", value: shopifyFileId }
            ]
          }
        }
      }
    );
    const metaobjectData = await metaobjectRes.json();
    const metaobjectErrors = metaobjectData.data?.metaobjectCreate?.userErrors || [];
    
    if (metaobjectErrors.length > 0) {
      return json({ 
        success: false, 
        error: `Metaobject Configuration Error: ${metaobjectErrors[0].message}` 
      }, { status: 400 });
    }

    const newMetaobjectId = metaobjectData.data?.metaobjectCreate?.metaobject?.id;
    if (!newMetaobjectId) return json({ success: false, error: "Metaobject creation returned empty payload data." }, { status: 400 });

    // --- STEP 5: Attach Metaobject to Customer (Using formattedCustomerId) ---
    const customerQueryRes = await admin.graphql(
      `query getCustomerMetafields($id: ID!) {
        customer(id: $id) {
          metafield(namespace: "custom", key: "partner_campaigns") { value }
        }
      }`,
      { variables: { id: formattedCustomerId } }
    );
    const customerData = await customerQueryRes.json();
    
    let existingCampaigns: string[] = [];
    const existingMetafieldValue = customerData.data?.customer?.metafield?.value;
    
    if (existingMetafieldValue) {
       existingCampaigns = JSON.parse(existingMetafieldValue); 
    }
    
    existingCampaigns.push(newMetaobjectId);

    const customerUpdateRes = await admin.graphql(
      `mutation updateCustomerMetafield($input: CustomerInput!) {
        customerUpdate(input: $input) {
          userErrors { message }
        }
      }`,
      {
        variables: {
          input: {
            id: formattedCustomerId,
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
    
    const customerUpdateData = await customerUpdateRes.json();
    const customerErrors = customerUpdateData.data?.customerUpdate?.userErrors || [];
    if (customerErrors.length > 0) {
      return json({ success: false, error: `Customer Link Error: ${customerErrors[0].message}` }, { status: 400 });
    }

    return json({ success: true, message: "Campaign created and linked" });

  } catch (error: any) {
    console.error("CAMPAIGN CREATION ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}