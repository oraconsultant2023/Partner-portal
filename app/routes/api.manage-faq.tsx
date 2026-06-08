import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// 1. GET: Fetch all FAQ entries
export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

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

  const data: any = await response.json();
  const faqList = data.data?.metaobjects?.nodes.map((node: any) => {
    const faq: any = { id: node.id };
    node.fields.forEach((f: any) => faq[f.key] = f.value);
    return faq;
  });

  return json({ success: true, faq: faqList });
}

// 2. POST: Create a new FAQ entry
export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  const { question, answer } = await request.json();

  const response = await admin.graphql(`
    mutation CreateFaq($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject { id }
        userErrors { message }
      }
    }
  `, {
    variables: {
      metaobject: {
        type: "partner_faq",
        fields: [
          { key: "question", value: question },
          { key: "answer", value: answer }
        ]
      }
    }
  });

  const data: any = await response.json();
  if (data.data?.metaobjectCreate?.userErrors?.length > 0) {
    return json({ success: false, error: data.data.metaobjectCreate.userErrors[0].message });
  }

  return json({ success: true });
}