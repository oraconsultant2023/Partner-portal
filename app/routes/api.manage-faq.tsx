import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// 1. GET: Fetch list of FAQs
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { admin } = await authenticate.public.appProxy(request);
    if (!admin) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const response = await admin.graphql(`
      query {
        metaobjects(type: "partner_faq", first: 50) {
          nodes {
            id
            fields {
              key
              value
            }
          }
        }
      }
    `);

    const result: any = await response.json();
    const faq = result?.data?.metaobjects?.nodes?.map((node: any) => {
      const item: any = { id: node.id };
      node.fields.forEach((field: any) => { item[field.key] = field.value; });
      return item;
    }) || [];

    return json({ success: true, faq });
  } catch (error: any) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

// 2. ACTION: Create or Delete
export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin } = await authenticate.public.appProxy(request);
    if (!admin) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const method = request.method;

    // DELETE LOGIC
    if (method === "DELETE") {
      const { id } = await request.json();
      const response = await admin.graphql(`
        mutation delete($id: ID!) { metaobjectDelete(id: $id) { deletedId userErrors { message } } }
      `, { variables: { id } });
      const data: any = await response.json();
      const errors = data?.data?.metaobjectDelete?.userErrors;
      return json({ success: !errors?.length, error: errors?.[0]?.message });
    }

    // CREATE LOGIC (POST)
    if (method === "POST") {
      const body = await request.json();
      const response = await admin.graphql(`
        mutation CreateFaq($metaobject: MetaobjectCreateInput!) {
          metaobjectCreate(metaobject: $metaobject) {
            metaobject { id }
            userErrors { field message }
          }
        }
      `, {
        variables: {
          metaobject: {
            type: "partner_faq",
            fields: [
              { key: "question", value: body.question },
              { key: "answer", value: body.answer },
              { key: "category", value: body.category }
            ],
          },
        },
      });

      const data: any = await response.json();
      const errors = data?.data?.metaobjectCreate?.userErrors;
      if (errors?.length) return json({ success: false, error: errors[0].message });
      return json({ success: true });
    }

    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  } catch (error: any) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}