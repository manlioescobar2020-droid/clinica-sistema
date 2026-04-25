-- CreateTable
CREATE TABLE "HealthInsurance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "HealthInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorHealthInsurance" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "healthInsuranceId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DoctorHealthInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthInsurance_name_key" ON "HealthInsurance"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorHealthInsurance_doctorId_healthInsuranceId_key" ON "DoctorHealthInsurance"("doctorId", "healthInsuranceId");

-- AddForeignKey
ALTER TABLE "DoctorHealthInsurance" ADD CONSTRAINT "DoctorHealthInsurance_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorHealthInsurance" ADD CONSTRAINT "DoctorHealthInsurance_healthInsuranceId_fkey" FOREIGN KEY ("healthInsuranceId") REFERENCES "HealthInsurance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
