import { Router, type IRouter, type Request, type Response } from "express";
import { getDb } from "@workspace/db";
import {
  agentsTable,
  agentVariantsTable,
  conversationsTable,
  customersTable,
  abTestResultsTable,
  type InsertAgent,
  type InsertAgentVariant,
  type InsertConversation,
  type InsertCustomer,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();
const db = getDb();

// Middleware to check API key
const authMiddleware = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  const apiKey = process.env.COMMAND_API_KEY;

  if (!apiKey) {
    console.warn("COMMAND_API_KEY not set in environment");
    return next();
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  if (token !== apiKey) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
};

router.use(authMiddleware);

// GET /api/agents/:agent_id
router.get("/agents/:agent_id", async (req: Request, res: Response) => {
  try {
    const { agent_id } = req.params;
    const agent = await db.query.agentsTable.findFirst({
      where: eq(agentsTable.id, agent_id),
      with: {
        variants: {
          where: eq(agentVariantsTable.is_control, true),
        },
      },
    });

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json(agent);
  } catch (error) {
    console.error("Error fetching agent:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/agents
router.get("/agents", async (req: Request, res: Response) => {
  try {
    const agents = await db.query.agentsTable.findMany();
    res.json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/agents
router.post("/agents", async (req: Request, res: Response) => {
  try {
    const { name, brand_id, mode, avatar_url, channels } = req.body;

    if (!name || !brand_id || !mode) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newAgent = await db
      .insert(agentsTable)
      .values({
        name,
        brand_id,
        mode,
        avatar_url,
        channels: channels || {},
      } as InsertAgent)
      .returning();

    res.status(201).json(newAgent[0]);
  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/agents/:agent_id/variants
router.get("/agents/:agent_id/variants", async (req: Request, res: Response) => {
  try {
    const { agent_id } = req.params;
    const variants = await db.query.agentVariantsTable.findMany({
      where: eq(agentVariantsTable.agent_id, agent_id),
    });

    res.json(variants);
  } catch (error) {
    console.error("Error fetching variants:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/agents/:agent_id/variants
router.post("/agents/:agent_id/variants", async (req: Request, res: Response) => {
  try {
    const { agent_id } = req.params;
    const {
      variant_name,
      system_prompt,
      greeting_message,
      address_validation_instructions,
      closing_instructions,
      objection_handling,
      is_control,
    } = req.body;

    if (!variant_name || !system_prompt || !greeting_message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newVariant = await db
      .insert(agentVariantsTable)
      .values({
        agent_id,
        variant_name,
        system_prompt,
        greeting_message,
        address_validation_instructions,
        closing_instructions,
        objection_handling,
        is_control: is_control || false,
      } as InsertAgentVariant)
      .returning();

    res.status(201).json(newVariant[0]);
  } catch (error) {
    console.error("Error creating variant:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/conversations
router.post("/conversations", async (req: Request, res: Response) => {
  try {
    const {
      agent_id,
      brand_id,
      customer_id,
      channel,
      variant_id,
      role,
      content,
      outcome,
    } = req.body;

    if (!agent_id || !brand_id || !channel) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Find or create conversation (get latest for this agent+customer+variant on this channel)
    let conversation = await db.query.conversationsTable.findFirst({
      where: and(
        eq(conversationsTable.agent_id, agent_id),
        eq(conversationsTable.customer_id, customer_id),
        eq(conversationsTable.channel, channel),
        eq(conversationsTable.variant_id, variant_id)
      ),
      orderBy: (conversations, { desc }) => [desc(conversations.created_at)],
    });

    const newMessage = { role, content, timestamp: new Date().toISOString() };

    if (conversation) {
      // Append to existing conversation
      const updatedMessages = [...(conversation.messages as any[]), newMessage];
      const [updated] = await db
        .update(conversationsTable)
        .set({
          messages: updatedMessages,
          outcome: outcome || conversation.outcome,
          updated_at: new Date(),
        })
        .where(eq(conversationsTable.id, conversation.id))
        .returning();

      res.json(updated);
    } else {
      // Create new conversation
      const [created] = await db
        .insert(conversationsTable)
        .values({
          agent_id,
          brand_id,
          customer_id,
          channel,
          variant_id,
          messages: [newMessage],
          outcome,
        } as InsertConversation)
        .returning();

      res.status(201).json(created);
    }
  } catch (error) {
    console.error("Error logging conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/customers/search
router.get("/customers/search", async (req: Request, res: Response) => {
  try {
    const { phone, address, brand_id } = req.query;

    if (!brand_id || (!phone && !address)) {
      return res
        .status(400)
        .json({ error: "brand_id and (phone or address) required" });
    }

    let customer = null;

    if (phone) {
      customer = await db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.phone, phone as string),
          eq(customersTable.brand_id, brand_id as string)
        ),
      });
    }

    if (!customer && address) {
      const [street, city] = (address as string).split(",").map((s: string) => s.trim());
      customer = await db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.city, city),
          eq(customersTable.street_name, street),
          eq(customersTable.brand_id, brand_id as string)
        ),
      });
    }

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(customer);
  } catch (error) {
    console.error("Error searching customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/customers
router.post("/customers", async (req: Request, res: Response) => {
  try {
    const {
      brand_id,
      phone,
      email,
      name,
      street_number,
      street_name,
      city,
      state,
      zip_code,
      latitude,
      longitude,
    } = req.body;

    if (!brand_id) {
      return res.status(400).json({ error: "brand_id required" });
    }

    // Check if customer exists by phone or address
    let existingCustomer = null;

    if (phone) {
      existingCustomer = await db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.phone, phone),
          eq(customersTable.brand_id, brand_id)
        ),
      });
    }

    if (!existingCustomer && street_name && city) {
      existingCustomer = await db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.street_name, street_name),
          eq(customersTable.city, city),
          eq(customersTable.brand_id, brand_id)
        ),
      });
    }

    if (existingCustomer) {
      // Update existing customer
      const [updated] = await db
        .update(customersTable)
        .set({
          name: name || existingCustomer.name,
          email: email || existingCustomer.email,
          latitude: latitude || existingCustomer.latitude,
          longitude: longitude || existingCustomer.longitude,
          updated_at: new Date(),
        })
        .where(eq(customersTable.id, existingCustomer.id))
        .returning();

      return res.json(updated);
    }

    // Create new customer
    const [created] = await db
      .insert(customersTable)
      .values({
        brand_id,
        phone,
        email,
        name,
        street_number,
        street_name,
        city,
        state,
        zip_code,
        latitude,
        longitude,
      } as InsertCustomer)
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/agents/:agent_id/ab-tests
router.get("/agents/:agent_id/ab-tests", async (req: Request, res: Response) => {
  try {
    const { agent_id } = req.params;

    const latestTest = await db.query.abTestResultsTable.findFirst({
      where: eq(abTestResultsTable.agent_id, agent_id),
      orderBy: (abTests, { desc }) => [desc(abTests.created_at)],
    });

    res.json(latestTest || {});
  } catch (error) {
    console.error("Error fetching A/B test:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
