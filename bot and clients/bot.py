import logging
from telegram import Update
from telegram.ext import (
    ApplicationBuilder, CommandHandler, MessageHandler,
    ConversationHandler, ContextTypes, filters
)
from db import init_db, add_client

logging.basicConfig(level=logging.INFO)

ASK_NAME, ASK_PHONE, ASK_DATE = range(3)
user_data = {}


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Hola! como te llamas?")
    return ASK_NAME


async def ask_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    user_data[user_id] = {"name": update.message.text}
    await update.message.reply_text("Cuál es vuestro número de telefono?")
    return ASK_PHONE


async def ask_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    user_data[user_id]["phone"] = update.message.text
    await update.message.reply_text("¿En qué fecha debo escribirlo? (formato 2026-01-20)")
    return ASK_DATE


async def finish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    user_data[user_id]["date"] = update.message.text

    add_client(
        user_data[user_id]["name"],
        user_data[user_id]["phone"],
        user_data[user_id]["date"]
    )

    await update.message.reply_text("¡Listo! Estás registrado.")
    return ConversationHandler.END


def main():
    init_db()

    app = ApplicationBuilder().token("8416186702:AAGTh0SwjWhlc0DJdf3ptE2dyZusXPvYe3s").build()

    conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            ASK_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_phone)],
            ASK_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_date)],
            ASK_DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, finish)],
        },
        fallbacks=[],
    )

    app.add_handler(conv)

    print("BOT STARTED...")
    app.run_polling()


if __name__ == "__main__":
    main()
