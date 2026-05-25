import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: any) {

  // SECRET CHECK
  const key =
    request.headers.get(
      "x-admin-secret"
    );

  if (
    key !== process.env.ADMIN_API_SECRET
  ) {

    return json(
      { error: "Unauthorized" },
      { status: 401 }
    );

  }

  // SHOPIFY AUTH
const response = await fetch(
  `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-04/graphql.json`,
  {
    method: "POST",

    headers: {
      "Content-Type": "application/json",

      "X-Shopify-Access-Token":
        process.env.SHOPIFY_ADMIN_TOKEN!,
    },

    body: JSON.stringify({
      query: `
        query {

          metaobjects(
            type: "brand_application",
            first: 50
          ) {

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
      `
    })

  }
);

  const result = await response.json();

  const applications =
    result.data.metaobjects.edges.map(
      (edge: any) => {

        const fields: any = {};

        edge.node.fields.forEach(
          (field: any) => {
            fields[field.key] = field.value;
          }
        );

        return {

          id: edge.node.id,

          brand_name:
            fields.brand_name || "",

          email:
            fields.email || "",

          category:
            fields.category || "",

          publish_status:
            edge.node.capabilities?.publishable?.status ||
            "ACTIVE"

        };

      }
    );

  return json(applications);

}