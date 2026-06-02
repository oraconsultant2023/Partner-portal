import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, { status: 405 });

  try {
    const body = await request.json();
    const {
      title,
      description,
      placementType,
      specs,
      rate,
      status,
      fileName,
      fileData,
      mimeType,
    } = body;

    let shopifyFileId = null;

    // --- STEP 1: Process Thumbnail Image (If provided) ---
    if (fileName && fileData) {
      const stagedUploadsQuery = `
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets { url resourceUrl parameters { name value } }
          }
        }`;
      const stagedUploadRes = await admin.graphql(stagedUploadsQuery, {
        variables: {
          input: [
            {
              filename: fileName,
              mimeType: mimeType,
              resource: "FILE",
              httpMethod: "POST",
            },
          ],
        },
      });
      const stagedUploadData = await stagedUploadRes.json();
      const target = stagedUploadData.data.stagedUploadsCreate.stagedTargets[0];

      const buffer = Buffer.from(fileData, "base64");
      const formData = new FormData();
      target.parameters.forEach((p: any) => formData.append(p.name, p.value));
      formData.append("file", new Blob([buffer], { type: mimeType }));

      const uploadResponse = await fetch(target.url, {
        method: "POST",
        body: formData,
      });

      if (uploadResponse.ok) {
        const createFileQuery = `
          mutation fileCreate($files: [FileCreateInput!]!) {
            fileCreate(files: $files) {
              files { id }
            }
          }`;
        const createFileRes = await admin.graphql(createFileQuery, {
          variables: {
            files: [
              {
                originalSource: target.resourceUrl,
                alt: fileName,
                contentType: "IMAGE",
              },
            ],
          },
        });
        const createFileData = await createFileRes.json();
        shopifyFileId = createFileData.data.fileCreate.files[0].id;
      }
    }

    // --- STEP 2: Build the Metaobject Fields ---
    const fields = [
      { key: "title", value: title },
      { key: "description", value: description },
      { key: "placement_type", value: placementType },
      { key: "specs", value: specs },
      { key: "rate", value: rate },
      { key: "inventory_status", value: status || "Available" },
    ];

    if (shopifyFileId) {
      fields.push({ key: "thumbnail", value: shopifyFileId });
    }

    // --- STEP 3: Create the Metaobject ---
    const metaobjectRes = await admin.graphql(
      `mutation CreateSponsorshipSlot($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          metaobject: {
            type: "sponsorship_slot",
            capabilities: {
              publishable: {
                status: "ACTIVE"
              }
            },
            fields: fields
          }
        }
      },
    );

    const metaobjectData = await metaobjectRes.json();
    const errors = metaobjectData.data?.metaobjectCreate?.userErrors || [];

    if (errors.length > 0) {
      return json(
        { success: false, error: `Metaobject Error: ${errors[0].message}` },
        { status: 400 },
      );
    }

    return json({
      success: true,
      message: "Sponsorship slot created successfully!",
    });
  } catch (error: any) {
    console.error("SPONSORSHIP CREATION ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
