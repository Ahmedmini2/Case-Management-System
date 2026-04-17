import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function seed() {
  // Clear existing
  await db.whatsAppMessage.deleteMany();
  await db.whatsAppConversation.deleteMany();

  const convs = [
    {
      contactName: "Khalid Al Rashid",
      contactPhone: "+971501234567",
      lastMessage: "Hey, I ordered the Shadow Reaper hoodie but got the wrong size. Can I exchange?",
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 3),
      unreadCount: 2,
      status: "ACTIVE" as const,
      handledBy: "AI" as const,
      tags: ["orders", "exchange"],
    },
    {
      contactName: "Sarah Martinez",
      contactPhone: "+971559876543",
      lastMessage: "When will the Phantom Drop collection restock?",
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 15),
      unreadCount: 0,
      status: "ACTIVE" as const,
      handledBy: "AI" as const,
      tags: ["product-inquiry"],
    },
    {
      contactName: "Omar Hassan",
      contactPhone: "+971521112233",
      lastMessage: "Thanks for the help, the refund came through!",
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      unreadCount: 0,
      status: "RESOLVED" as const,
      handledBy: "AI" as const,
      tags: ["refund"],
    },
    {
      contactName: "Fatima Al Maktoum",
      contactPhone: "+971507778899",
      lastMessage: "I want to place a bulk order of 50 pieces for my crew. What discount do you offer?",
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 30),
      unreadCount: 3,
      status: "ACTIVE" as const,
      handledBy: "HUMAN" as const,
      tags: ["wholesale", "vip"],
    },
    {
      contactName: "Ahmed Bin Saeed",
      contactPhone: "+971504445566",
      lastMessage: "My package has been stuck in customs for 5 days. Order #DG-04521",
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 45),
      unreadCount: 1,
      status: "WAITING" as const,
      handledBy: "AI" as const,
      tags: ["shipping"],
    },
    {
      contactName: "Lina Khoury",
      contactPhone: "+961712345678",
      lastMessage: "Can I get custom embroidery on the Abyss Jacket?",
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 60),
      unreadCount: 0,
      status: "ACTIVE" as const,
      handledBy: "AI" as const,
      tags: ["customisation"],
    },
  ];

  const created = [];
  for (const conv of convs) {
    const c = await db.whatsAppConversation.create({ data: conv });
    created.push(c);
  }

  const messageGroups = [
    // Khalid - exchange conversation
    [
      { direction: "inbound", sender: "customer", senderName: "Khalid Al Rashid", body: "Assalamu alaikum, I need help with my order", isAI: false, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 10), isRead: true },
      { direction: "outbound", sender: "ai", senderName: "Dungeon AI", body: "Wa alaikum assalam, Khalid! Welcome to The Dungeon Gear support. How can I help you today?", isAI: true, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 9), isRead: true },
      { direction: "inbound", sender: "customer", senderName: "Khalid Al Rashid", body: "I ordered the Shadow Reaper hoodie in L but I need XL. Order is #DG-03891", isAI: false, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 8), isRead: true },
      { direction: "outbound", sender: "ai", senderName: "Dungeon AI", body: "I can see your order #DG-03891. The Shadow Reaper hoodie in size L. I can initiate an exchange to XL for you. Would you like me to proceed? The exchange is free of charge.", isAI: true, status: "delivered", timestamp: new Date(Date.now() - 1000 * 60 * 7), isRead: true },
      { direction: "inbound", sender: "customer", senderName: "Khalid Al Rashid", body: "Yes please! That would be great", isAI: false, status: "delivered", timestamp: new Date(Date.now() - 1000 * 60 * 5), isRead: false },
      { direction: "inbound", sender: "customer", senderName: "Khalid Al Rashid", body: "Hey, I ordered the Shadow Reaper hoodie but got the wrong size. Can I exchange?", isAI: false, status: "delivered", timestamp: new Date(Date.now() - 1000 * 60 * 3), isRead: false },
    ],
    // Sarah - restock inquiry
    [
      { direction: "inbound", sender: "customer", senderName: "Sarah Martinez", body: "Hi! Is the Phantom Drop collection coming back?", isAI: false, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 20), isRead: true },
      { direction: "outbound", sender: "ai", senderName: "Dungeon AI", body: "Hey Sarah! Great taste \u2014 the Phantom Drop was one of our most popular collections. We're planning a limited restock in late April. Want me to add you to the early access list?", isAI: true, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 19), isRead: true },
      { direction: "inbound", sender: "customer", senderName: "Sarah Martinez", body: "Yes please! Especially the oversized tee in black", isAI: false, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 17), isRead: true },
      { direction: "outbound", sender: "ai", senderName: "Dungeon AI", body: "Done! You're on the early access list for the Phantom Drop restock. You'll get a notification 24 hours before it goes live. Is there anything else I can help with?", isAI: true, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 16), isRead: true },
      { direction: "inbound", sender: "customer", senderName: "Sarah Martinez", body: "When will the Phantom Drop collection restock?", isAI: false, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 15), isRead: true },
    ],
    // Omar - resolved refund
    [
      { direction: "inbound", sender: "customer", senderName: "Omar Hassan", body: "Hi, I returned my order last week and haven't received the refund yet", isAI: false, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3), isRead: true },
      { direction: "outbound", sender: "ai", senderName: "Dungeon AI", body: "Hi Omar, let me check on that for you. I can see your return was received and processed. The refund of AED 389 has been initiated to your original payment method. It typically takes 3-5 business days to appear.", isAI: true, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3 + 60000), isRead: true },
      { direction: "inbound", sender: "customer", senderName: "Omar Hassan", body: "Thanks for the help, the refund came through!", isAI: false, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), isRead: true },
      { direction: "outbound", sender: "ai", senderName: "Dungeon AI", body: "Glad to hear that, Omar! If you need anything else in the future, don't hesitate to reach out. Stay dark. \ud83d\udda4", isAI: true, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2 + 30000), isRead: true },
    ],
    // Fatima - wholesale VIP (human-handled)
    [
      { direction: "inbound", sender: "customer", senderName: "Fatima Al Maktoum", body: "Hello, I run a streetwear collective in Abu Dhabi", isAI: false, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 60), isRead: true },
      { direction: "outbound", sender: "ai", senderName: "Dungeon AI", body: "Welcome, Fatima! That sounds amazing. How can The Dungeon Gear help your collective?", isAI: true, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 55), isRead: true },
      { direction: "inbound", sender: "customer", senderName: "Fatima Al Maktoum", body: "I want to place a bulk order of 50 pieces for my crew. Mixed styles from the Void collection. What discount do you offer?", isAI: false, status: "delivered", timestamp: new Date(Date.now() - 1000 * 60 * 50), isRead: false },
      { direction: "outbound", sender: "agent", senderName: "Ahmed (Agent)", body: "Hi Fatima! I've taken over this conversation. For bulk orders of 50+ pieces we offer 25% off wholesale pricing. Let me put together a custom quote for your crew.", isAI: false, status: "delivered", timestamp: new Date(Date.now() - 1000 * 60 * 40), isRead: true },
      { direction: "inbound", sender: "customer", senderName: "Fatima Al Maktoum", body: "That sounds great! Can you include the Abyss Jacket in the order too?", isAI: false, status: "delivered", timestamp: new Date(Date.now() - 1000 * 60 * 35), isRead: false },
      { direction: "inbound", sender: "customer", senderName: "Fatima Al Maktoum", body: "I want to place a bulk order of 50 pieces for my crew. What discount do you offer?", isAI: false, status: "delivered", timestamp: new Date(Date.now() - 1000 * 60 * 30), isRead: false },
    ],
    // Ahmed - shipping issue
    [
      { direction: "inbound", sender: "customer", senderName: "Ahmed Bin Saeed", body: "My order #DG-04521 tracking hasn't updated in days", isAI: false, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 60), isRead: true },
      { direction: "outbound", sender: "ai", senderName: "Dungeon AI", body: "Hi Ahmed, I'm looking into order #DG-04521 for you. It appears the package is currently in customs clearance. This can sometimes take a few extra days depending on the destination.", isAI: true, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 58), isRead: true },
      { direction: "inbound", sender: "customer", senderName: "Ahmed Bin Saeed", body: "My package has been stuck in customs for 5 days. Order #DG-04521", isAI: false, status: "delivered", timestamp: new Date(Date.now() - 1000 * 60 * 45), isRead: false },
    ],
    // Lina - customisation
    [
      { direction: "inbound", sender: "customer", senderName: "Lina Khoury", body: "Hi! Do you offer customisation on your jackets?", isAI: false, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 65), isRead: true },
      { direction: "outbound", sender: "ai", senderName: "Dungeon AI", body: "Hey Lina! Yes, we offer custom embroidery and printing on select pieces. The Abyss Jacket is one of our most popular items for customisation. What did you have in mind?", isAI: true, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 63), isRead: true },
      { direction: "inbound", sender: "customer", senderName: "Lina Khoury", body: "Can I get custom embroidery on the Abyss Jacket?", isAI: false, status: "read", timestamp: new Date(Date.now() - 1000 * 60 * 60), isRead: true },
    ],
  ];

  for (let i = 0; i < created.length; i++) {
    const msgs = messageGroups[i] ?? [];
    for (const msg of msgs) {
      await db.whatsAppMessage.create({
        data: { conversationId: created[i].id, ...msg },
      });
    }
  }

  console.log(`Seeded ${created.length} conversations with messages`);
}

seed()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
  });
