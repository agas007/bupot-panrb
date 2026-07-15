import assert from "node:assert/strict";
import test from "node:test";
import { getPrismaDatabaseErrorMessage, isPrismaConnectionError } from "../src/lib/prisma.ts";

test("classifies unreachable database errors", () => {
  const error = new Error("P1001: Can't reach database server at `db.example.com`");

  assert.equal(isPrismaConnectionError(error), true);
  assert.equal(getPrismaDatabaseErrorMessage(error), "Database tidak terhubung. Cek DATABASE_URL dan koneksi ke server DB dulu.");
});

test("classifies missing table errors as schema drift", () => {
  const error = new Error("The table does not exist");

  assert.equal(isPrismaConnectionError(error), false);
  assert.equal(
    getPrismaDatabaseErrorMessage(error),
    "Database terhubung, tapi schema/tabel belum lengkap. Jalankan migration Prisma di production dulu.",
  );
});
