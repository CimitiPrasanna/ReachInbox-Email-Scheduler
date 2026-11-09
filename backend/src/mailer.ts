import nodemailer from "nodemailer";

let transporterPromise: Promise<nodemailer.Transporter> | undefined;

export async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      let user = process.env.ETHEREAL_USER;
      let pass = process.env.ETHEREAL_PASS;
      if (!user || !pass) {
        const testAccount = await nodemailer.createTestAccount();
        user = testAccount.user;
        pass = testAccount.pass;
        console.log("Ethereal test account:", user);
      }
      return nodemailer.createTransport({
        host: "smtp.ethereal.email", port: 587, secure: false,
        auth: { user, pass }
      });
    })();
  }
  return transporterPromise;
}
