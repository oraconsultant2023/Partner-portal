import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { authenticate } from "../shopify.server";

/* GET FAQS */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { admin } = await authenticate.public.appProxy(request);

    if (!admin) {
      return json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    const faq =
      result?.data?.metaobjects?.nodes?.map((node: any) => {
        const item: any = { id: node.id };

        node.fields.forEach((field: any) => {
          item[field.key] = field.value;
        });

        return item;
      }) || [];

    return json({
      success: true,
      faq,
    });
  } catch (error: any) {
    console.error("FAQ LOADER ERROR:", error);

    return json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/* CREATE FAQ */
export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin } = await authenticate.public.appProxy(request);

    if (!admin) {
      return json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
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
                value: body.question,
              },
              {
                key: "answer",
                value: body.answer,
              },
            ],
          },
        },
      }
    );

    const data: any = await response.json();

    const errors = data?.data?.metaobjectCreate?.userErrors;

    if (errors?.length) {
      return json({
        success: false,
        error: errors[0].message,
      });
    }

    return json({
      success: true,
    });
  } catch (error: any) {
    console.error("FAQ ACTION ERROR:", error);

    return json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}