import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// --- HELPER FUNCTION: 3-Step Shopify Staged Upload ---
async function uploadFileToShopify(admin: any, base64Data: string, filename: string, mimeType: string) {
  // 1. Request Staged Upload URL
  const resourceType = mimeType.startsWith('image/') ? 'IMAGE' : 'FILE';
  const stagedResponse = await admin.graphql(`
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { message }
      }
    }
  `, {
    variables: {
      input: [{ filename, mimeType, httpMethod: "POST", resource: resourceType }]
    }
  });

  const stagedData = await stagedResponse.json();
  const target = stagedData.data.stagedUploadsCreate.stagedTargets[0];
  if (!target) throw new Error("Failed to generate upload target.");

  // 2. Upload file data to the target URL
  const formData = new FormData();
  target.parameters.forEach((param: any) => formData.append(param.name, param.value));
  
  const buffer = Buffer.from(base64Data, 'base64');
  const blob = new Blob([buffer], { type: mimeType });
  formData.append('file', blob, filename);

  const uploadResponse = await fetch(target.url, { method: 'POST', body: formData });
  if (!uploadResponse.ok) throw new Error("Failed to upload file data to storage.");

  // 3. Create the File record in Shopify
  const fileCreateResponse = await admin.graphql(`
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { id fileStatus }
        userErrors { message }
      }
    }
  `, {
    variables: {
      files: [{ originalSource: target.resourceUrl, contentType: resourceType }]
    }
  });

  const fileCreateData = await fileCreateResponse.json();
  const fileId = fileCreateData.data.fileCreate.files[0]?.id;
  if (!fileId) throw new Error("Failed to create file ID in Shopify.");

  return fileId; // Returns the gid://shopify/GenericFile/12345
}

// --- MAIN ACTION ---
export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  try {
    const body = await request.json();
    const { 
      title, category, description, buttonText, 
      thumbName, thumbMime, thumbData, 
      fileName, fileMime, fileData 
    } = body;

    // 1. Process both file uploads first
    const uploadedThumbGid = await uploadFileToShopify(admin, thumbData, thumbName, thumbMime);
    const uploadedFileGid = await uploadFileToShopify(admin, fileData, fileName, fileMime);

    // 2. Create the Metaobject with the real File IDs
    const response = await admin.graphql(`
      mutation CreatePartnerResource($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id handle }
          userErrors { message }
        }
      }
    `, {
      variables: {
        metaobject: {
          type: "partner_resource",
          capabilities: { publishable: { status: "ACTIVE" } },
          fields: [
            { key: "title", value: title },
            { key: "category", value: category },
            { key: "description", value: description },
            { key: "button_text", value: buttonText },
            { key: "thumbnail", value: uploadedThumbGid }, // REAL ID ATTACHED
            { key: "file", value: uploadedFileGid }        // REAL ID ATTACHED
          ]
        }
      }
    });

    const data = await response.json();
    const errors = data.data?.metaobjectCreate?.userErrors || [];

    if (errors.length > 0) {
      return json({ success: false, error: errors[0].message }, { status: 400 });
    }

    return json({ success: true, message: "Resource and files created successfully!" });

  } catch (error: any) {
    console.error("UPLOAD RESOURCE ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}