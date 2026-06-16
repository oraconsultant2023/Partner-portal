import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  try {
    const response = await admin.graphql(`
      query {
        metaobjects(type: "partner_campaign", first: 50, reverse: true) {
          edges {
            node {
              id
              fields {
                key
                value
                reference {
                  ... on GenericFile {
                    url
                  }
                  ... on Customer {
                    email
                  }
                }
              }
            }
          }
        }
      }
    `);
    
    const data = await response.json();
    
    if (data.data?.metaobjects?.edges) {
      const campaigns = data.data.metaobjects.edges.map((edge: any) => {
        const fields = edge.node.fields;
        
        // Helper to grab exact values or reference URLs/Emails
        const getField = (key: string) => fields.find((f: any) => f.key === key)?.value || "-";
        const getReferenceUrl = (key: string) => fields.find((f: any) => f.key === key)?.reference?.url || null;
        const getCustomerEmail = (key: string) => fields.find((f: any) => f.key === key)?.reference?.email || null;
        
        return {
          id: edge.node.id,
          campaign_name: getField("campaign_name"),
          status: getField("status"),
          start_date: getField("start_date"),
          end_date: getField("end_date"),
          // Adjust "partner_email" or "customer" depending on your exact Metaobject handle
          partner_email: getCustomerEmail("customer") || getField("partner_email"),
          invoice_url: getReferenceUrl("invoice_pdf")
        };
      });

      return json(campaigns);
    }

    return json([]);
  } catch (error: any) {
    console.error("GET CAMPAIGNS ERROR:", error);
    return json({ error: error.message }, { status: 500 });
  }
}