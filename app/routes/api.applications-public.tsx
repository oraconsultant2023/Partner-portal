import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";


export async function loader({ request }: any) {
  // 1. Authenticate via App Proxy (This replaces the manual secret check)
  const { admin } = await authenticate.public.appProxy(request);

  // If the request didn't come through Shopify's secure proxy, reject it.
  if (!admin) {
    return json({ error: "Unauthorized: Request must come through App Proxy" }, { status: 401 });
  }

  try {
    // 2. Fetch data directly using the authenticated admin object
    const response = await admin.graphql(`
      query {
        metaobjects(type: "brand_application", first: 50) {
          edges {
            node {
              id
              handle
              capabilities {
                publishable {
                  status
                }
              }
              fields {
                key
                value
              }
            }
          }
        }
      }
    `);

    const result: any = await response.json();

    if (result.errors) {
        
      console.error("GraphQL Errors:", result.errors);
      return json({ error: "GraphQL Query Failed" }, { status: 500 });
    }

    // 3. Format the data
    const applications = result.data.metaobjects.edges.map((edge: any) => {
      const fields: any = {};
      edge.node.fields.forEach((field: any) => {
        fields[field.key] = field.value;
      });

      return {

  id: edge.node.id,

  handle: edge.node.handle,

  brand_name:
    fields.brand_name || "",

  website:
    fields.website || "",

  contact_name:
    fields.contact_name || "",

  email:
    fields.email || "",

  category:
    fields.category || "",

  on_shopify:
    fields.on_shopify || "",

  placements:
    fields.placements || "",

  affiliate_program:
    fields.affiliate_program || "",

  affiliate_link:
    fields.affiliate_link || "",

  status:
    fields.status || "",

  internal_notes:
    fields.internal_notes || "",

  submitted_at:
    fields.submitted_at || "",

  publish_status:
    edge.node.capabilities?.publishable?.status || "ACTIVE"

};


    });

    return json(applications);

  } catch (error: any) {
    console.error("App Proxy Route Error:", error);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}