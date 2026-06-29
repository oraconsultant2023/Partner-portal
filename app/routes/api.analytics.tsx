import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ success: false, error: "Unauthorized access" }, { status: 401 });

  try {
    // 1. Fetch Applications (to count total and approved)
    const appsResponse = await admin.graphql(`
      query {
        metaobjects(type: "brand_application", first: 250) {
          edges {
            node {
              fields { key value }
            }
          }
        }
      }
    `);
    
    // 2. Fetch Sponsorship Requests (to sum revenue for approved requests)
    const sponsorshipsResponse = await admin.graphql(`
      query {
        metaobjects(type: "sponsorship_request", first: 250) {
          edges {
            node {
              fields { key value }
            }
          }
        }
      }
    `);

    const appsData = await appsResponse.json();
    const sponsorshipsData = await sponsorshipsResponse.json();

    // Process Applications
    let totalApplications = 0;
    let approvedApplications = 0;

    if (appsData.data?.metaobjects?.edges) {
      const edges = appsData.data.metaobjects.edges;
      totalApplications = edges.length;
      
      approvedApplications = edges.filter((edge: any) => {
        const statusField = edge.node.fields.find((f: any) => f.key === "status");
        return statusField && statusField.value.toLowerCase() === "approved";
      }).length;
    }

    // Process Sponsorship Revenue
    let sponsorshipRevenue = 0;

    if (sponsorshipsData.data?.metaobjects?.edges) {
      sponsorshipsData.data.metaobjects.edges.forEach((edge: any) => {
        const fields = edge.node.fields;
        const statusField = fields.find((f: any) => f.key === "status");
        
        // Only count revenue for Approved requests
        if (statusField && statusField.value === "Approved") {
          const rateField = fields.find((f: any) => f.key === "slot_rate");
          if (rateField && rateField.value) {
            // Remove any non-numeric characters (like '$' or commas) and parse to float
            const cleanRate = rateField.value.replace(/[^0-9.]/g, '');
            const rateValue = parseFloat(cleanRate);
            if (!isNaN(rateValue)) {
              sponsorshipRevenue += rateValue;
            }
          }
        }
      });
    }

    return json({
      success: true,
      totalApplications,
      approvedApplications,
      sponsorshipRevenue
    });

  } catch (error: any) {
    console.error("Analytics Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}