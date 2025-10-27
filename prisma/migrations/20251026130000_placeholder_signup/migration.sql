-- Create table for placeholder email signups
CREATE TABLE "PlaceholderSignup" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaceholderSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlaceholderSignup_email_key" ON "PlaceholderSignup"("email");
