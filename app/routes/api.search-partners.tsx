import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const term = url.searchParams.get("term") || "";

  try {
    const response = await admin.graphql(
      `query searchPartners($query: String!) {
        customers(first: 10, query: $query) {
          edges {
            node {
              id
              firstName
              lastName
              email
            }
          }
        }
      }`,
      {
        variables: {
          query: `tag:partner AND (email:*${term}* OR first_name:*${term}*)`
        }
      }
    );

    const result = await response.json();
    // Explicitly type the edge parameter to avoid implicit 'any' errors
    const customers = result.data.customers.edges.map((edge: { node: any }) => edge.node);

    return json({ customers });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}