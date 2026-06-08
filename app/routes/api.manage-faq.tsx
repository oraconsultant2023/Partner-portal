import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";


export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin } = await authenticate.public.appProxy(request);

    if (!admin) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const response = await admin.graphql(
      `
      mutation CreateFaq($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
      `,
      {
        variables: {
          metaobject: {
            type: "partner_faq",
            fields: [
              {
                key: "question",
                value: body.question
              },
              {
                key: "answer",
                value: body.answer
              }
            ]
          }
        }
      }
    );

    const data: any = await response.json();

    console.log("FAQ CREATE RESPONSE:", JSON.stringify(data, null, 2));

    const errors = data?.data?.metaobjectCreate?.userErrors;

    if (errors?.length) {
      return json({
        success: false,
        error: errors[0].message
      });
    }

    return json({
      success: true
    });

  } catch (error: any) {
    console.error("FAQ ERROR:", error);

    return json(
      {
        success: false,
        error: error?.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}