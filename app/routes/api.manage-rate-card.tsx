import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// GET: Fetch all Rate Card Entries
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { admin } = await authenticate.public.appProxy(request);
    if (!admin) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const response = await admin.graphql(`
      query {
        metaobjects(type: "rate_card_entry", first: 50) {
          edges {
            node {
              id
              fields { key value }
            }
          }
        }
      }
    `);

    const data: any = await response.json();
    const entries = data.data.metaobjects.edges.map((edge: any) => {
      const fields = edge.node.fields.reduce((acc: any, field: any) => {
        acc[field.key] = field.value;
        return acc;
      }, {});
      return { id: edge.node.id, ...fields };
    });

    return json({ success: true, entries });
  } catch (error: any) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST/DELETE: Create or Remove Entries
export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin } = await authenticate.public.appProxy(request);
    if (!admin) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const method = request.method;
    const body = await request.json();

    if (method === "POST") {
      const response = await admin.graphql(`
        mutation CreateRateCardEntry($metaobject: MetaobjectCreateInput!) {
          metaobjectCreate(metaobject: $metaobject) {
            metaobject { id }
            userErrors { field message }
          }
        }
      `, {
        variables: {
          metaobject: {
            type: "rate_card_entry",
            capabilities: { publishable: { status: "ACTIVE" } },
            fields: [
              { key: "title", value: body.title },
              { key: "description", value: body.description },
              { key: "audience_stat", value: body.audience_stat },
              { key: "audience_subtext", value: body.audience_subtext },
              { key: "benchmark", value: body.benchmark },
              { key: "price", value: body.price },
              { key: "notes", value: body.notes }
            ]
          }
        }
      });

      const data: any = await response.json();
      const errors = data?.data?.metaobjectCreate?.userErrors;
      if (errors?.length > 0) return json({ success: false, error: errors[0].message });
      return json({ success: true });
    }

    if (method === "DELETE") {
      const response = await admin.graphql(`
        mutation DeleteRateCardEntry($id: ID!) {
          metaobjectDelete(id: $id) {
            deletedId
            userErrors { message }
          }
        }
      `, { variables: { id: body.id } });

      const data: any = await response.json();
      const errors = data?.data?.metaobjectDelete?.userErrors;
      if (errors?.length > 0) return json({ success: false, error: errors[0].message });
      return json({ success: true });
    }

    return json({ success: false, error: "Invalid method" }, { status: 405 });
  } catch (error: any) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}