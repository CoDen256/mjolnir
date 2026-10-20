.class public final Lcom/lightblitzlearning/ota/OtaPackage;
.super Ljava/lang/Object;
.source "OtaPackage.java"

# interfaces
.implements Lexpo/modules/core/interfaces/Package;
.implements Lexpo/modules/core/interfaces/ReactNativeHostHandler;
.implements Ljava/lang/Runnable;


# static fields
.field private static final BAKED_TOKEN:Ljava/lang/String; = "__MJOLNIR_OTA_TOKEN__"

.field private static final BAKED_URL:Ljava/lang/String; = "__MJOLNIR_OTA_URL__"

.field private static final CONNECT_TIMEOUT_MS:I = 0x2710

.field private static final MAGIC:[B

.field private static final MAX_REDIRECTS:I = 0x5

.field private static final MAX_SIZE:J = 0x4000000L

.field private static final READ_TIMEOUT_MS:I = 0x7530

.field private static final REFRESH_WALLCLOCK_MS:J = 0x1d4c0L

.field private static final TAG:Ljava/lang/String; = "mjolnir-ota"


# instance fields
.field private ctx:Landroid/content/Context;

.field private lastTier:Ljava/lang/String;


# direct methods
.method static constructor <clinit>()V
    .registers 2

    .line 60
    sget-object v0, Ljava/nio/charset/StandardCharsets;->US_ASCII:Ljava/nio/charset/Charset;

    .line 61
    const-string v1, "var __BUNDLE_START_TIME__="

    invoke-virtual {v1, v0}, Ljava/lang/String;->getBytes(Ljava/nio/charset/Charset;)[B

    move-result-object v0

    sput-object v0, Lcom/lightblitzlearning/ota/OtaPackage;->MAGIC:[B

    .line 60
    return-void
.end method

.method public constructor <init>()V
    .registers 2

    .line 47
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    .line 103
    const-string v0, "none"

    iput-object v0, p0, Lcom/lightblitzlearning/ota/OtaPackage;->lastTier:Ljava/lang/String;

    return-void
.end method

.method private activationOk(Ljava/io/File;)Z
    .registers 7

    .line 224
    invoke-virtual {p1}, Ljava/io/File;->length()J

    move-result-wide v0

    const-wide/16 v2, 0x0

    cmp-long v0, v0, v2

    const/4 v1, 0x0

    if-gtz v0, :cond_c

    return v1

    .line 225
    :cond_c
    sget-object v0, Lcom/lightblitzlearning/ota/OtaPackage;->MAGIC:[B

    array-length v0, v0

    new-array v2, v0, [B

    .line 226
    nop

    .line 228
    const/4 v3, 0x0

    :try_start_13
    new-instance v4, Ljava/io/FileInputStream;

    invoke-direct {v4, p1}, Ljava/io/FileInputStream;-><init>(Ljava/io/File;)V
    :try_end_18
    .catch Ljava/io/IOException; {:try_start_13 .. :try_end_18} :catch_3f
    .catchall {:try_start_13 .. :try_end_18} :catchall_3a

    .line 229
    move p1, v1

    .line 230
    :goto_19
    if-ge p1, v0, :cond_2f

    .line 231
    sub-int v3, v0, p1

    :try_start_1d
    invoke-virtual {v4, v2, p1, v3}, Ljava/io/InputStream;->read([BII)I

    move-result v3
    :try_end_21
    .catch Ljava/io/IOException; {:try_start_1d .. :try_end_21} :catch_2c
    .catchall {:try_start_1d .. :try_end_21} :catchall_29

    .line 232
    if-gez v3, :cond_27

    .line 238
    invoke-static {v4}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 232
    return v1

    .line 233
    :cond_27
    add-int/2addr p1, v3

    .line 234
    goto :goto_19

    .line 238
    :catchall_29
    move-exception p1

    move-object v3, v4

    goto :goto_3b

    .line 235
    :catch_2c
    move-exception p1

    move-object v3, v4

    goto :goto_40

    .line 238
    :cond_2f
    invoke-static {v4}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 239
    nop

    .line 240
    sget-object p1, Lcom/lightblitzlearning/ota/OtaPackage;->MAGIC:[B

    invoke-static {v2, p1}, Ljava/util/Arrays;->equals([B[B)Z

    move-result p1

    return p1

    .line 238
    :catchall_3a
    move-exception p1

    :goto_3b
    invoke-static {v3}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 239
    throw p1

    .line 235
    :catch_3f
    move-exception p1

    .line 236
    :goto_40
    nop

    .line 238
    invoke-static {v3}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 236
    return v1
.end method

.method private static bundleId(Ljava/lang/String;)Ljava/lang/String;
    .registers 5

    .line 533
    const-string v0, "bundle-"

    invoke-virtual {p0, v0}, Ljava/lang/String;->startsWith(Ljava/lang/String;)Z

    move-result v1

    const/4 v2, 0x0

    if-eqz v1, :cond_2b

    const-string v1, ".js"

    invoke-virtual {p0, v1}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z

    move-result v3

    if-nez v3, :cond_12

    goto :goto_2b

    .line 534
    :cond_12
    invoke-virtual {v0}, Ljava/lang/String;->length()I

    move-result v0

    invoke-virtual {p0}, Ljava/lang/String;->length()I

    move-result v3

    invoke-virtual {v1}, Ljava/lang/String;->length()I

    move-result v1

    sub-int/2addr v3, v1

    invoke-virtual {p0, v0, v3}, Ljava/lang/String;->substring(II)Ljava/lang/String;

    move-result-object p0

    .line 535
    invoke-static {p0}, Lcom/lightblitzlearning/ota/OtaPackage;->validId(Ljava/lang/String;)Z

    move-result v0

    if-eqz v0, :cond_2a

    move-object v2, p0

    :cond_2a
    return-object v2

    .line 533
    :cond_2b
    :goto_2b
    return-object v2
.end method

.method private static closeQuietly(Ljava/io/Closeable;)V
    .registers 1

    .line 654
    if-eqz p0, :cond_7

    .line 656
    :try_start_2
    invoke-interface {p0}, Ljava/io/Closeable;->close()V
    :try_end_5
    .catch Ljava/io/IOException; {:try_start_2 .. :try_end_5} :catch_6

    .line 659
    goto :goto_7

    .line 657
    :catch_6
    move-exception p0

    .line 661
    :cond_7
    :goto_7
    return-void
.end method

.method private commit(Ljava/io/File;Ljava/lang/String;)Ljava/lang/String;
    .registers 7

    .line 194
    invoke-static {p1, p2}, Lcom/lightblitzlearning/ota/OtaPackage;->countAttempts(Ljava/io/File;Ljava/lang/String;)I

    move-result v0

    .line 195
    new-instance v1, Ljava/io/File;

    new-instance v2, Ljava/lang/StringBuilder;

    invoke-direct {v2}, Ljava/lang/StringBuilder;-><init>()V

    const-string v3, "attempt-"

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2, p2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v3, "-"

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    add-int/lit8 v0, v0, 0x1

    invoke-virtual {v2, v0}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-direct {v1, p1, v0}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-static {v1}, Lcom/lightblitzlearning/ota/OtaPackage;->touch(Ljava/io/File;)V

    .line 196
    new-instance v0, Ljava/io/File;

    new-instance v1, Ljava/lang/StringBuilder;

    invoke-direct {v1}, Ljava/lang/StringBuilder;-><init>()V

    const-string v2, "bundle-"

    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v1

    invoke-virtual {v1, p2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object p2

    const-string v1, ".js"

    invoke-virtual {p2, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object p2

    invoke-virtual {p2}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object p2

    invoke-direct {v0, p1, p2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-virtual {v0}, Ljava/io/File;->getAbsolutePath()Ljava/lang/String;

    move-result-object p1

    return-object p1
.end method

.method private static countAttempts(Ljava/io/File;Ljava/lang/String;)I
    .registers 6

    .line 570
    const/4 v0, 0x0

    .line 571
    :goto_1
    new-instance v1, Ljava/io/File;

    new-instance v2, Ljava/lang/StringBuilder;

    invoke-direct {v2}, Ljava/lang/StringBuilder;-><init>()V

    const-string v3, "attempt-"

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2, p1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v3, "-"

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    add-int/lit8 v3, v0, 0x1

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v2

    invoke-direct {v1, p0, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-virtual {v1}, Ljava/io/File;->exists()Z

    move-result v1

    if-eqz v1, :cond_2d

    move v0, v3

    goto :goto_1

    .line 572
    :cond_2d
    return v0
.end method

.method private static deleteAttempts(Ljava/io/File;Ljava/lang/String;)V
    .registers 6

    .line 576
    const/4 v0, 0x1

    .line 578
    :goto_1
    new-instance v1, Ljava/io/File;

    new-instance v2, Ljava/lang/StringBuilder;

    invoke-direct {v2}, Ljava/lang/StringBuilder;-><init>()V

    const-string v3, "attempt-"

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2, p1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v3, "-"

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2, v0}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v2

    invoke-direct {v1, p0, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-virtual {v1}, Ljava/io/File;->exists()Z

    move-result v2

    if-eqz v2, :cond_2f

    .line 579
    invoke-virtual {v1}, Ljava/io/File;->delete()Z

    .line 580
    add-int/lit8 v0, v0, 0x1

    goto :goto_1

    .line 582
    :cond_2f
    return-void
.end method

.method private download(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;JLjava/lang/String;Ljava/io/File;Ljava/io/File;J)Z
    .registers 29

    .line 365
    move-object/from16 v1, p0

    move-object/from16 v0, p6

    move-object/from16 v2, p7

    move-object/from16 v3, p8

    move-wide/from16 v4, p9

    const/4 v6, 0x0

    :try_start_b
    const-string v7, "SHA-256"

    invoke-static {v7}, Ljava/security/MessageDigest;->getInstance(Ljava/lang/String;)Ljava/security/MessageDigest;

    move-result-object v7
    :try_end_11
    .catch Ljava/lang/Exception; {:try_start_b .. :try_end_11} :catch_174

    .line 368
    nop

    .line 369
    nop

    .line 370
    nop

    .line 371
    nop

    .line 373
    const/4 v8, 0x0

    move-object/from16 v9, p1

    move-object/from16 v10, p2

    :try_start_1a
    invoke-direct {v1, v9, v10, v4, v5}, Lcom/lightblitzlearning/ota/OtaPackage;->open(Ljava/lang/String;Ljava/lang/String;J)Ljava/net/HttpURLConnection;

    move-result-object v9
    :try_end_1e
    .catch Ljava/io/IOException; {:try_start_1a .. :try_end_1e} :catch_163
    .catchall {:try_start_1a .. :try_end_1e} :catchall_153

    .line 374
    if-nez v9, :cond_2c

    .line 403
    invoke-static {v8}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 404
    invoke-static {v8}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 405
    if-eqz v9, :cond_2b

    invoke-virtual {v9}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 374
    :cond_2b
    return v6

    .line 375
    :cond_2c
    :try_start_2c
    invoke-virtual {v9}, Ljava/net/HttpURLConnection;->getInputStream()Ljava/io/InputStream;

    move-result-object v10
    :try_end_30
    .catch Ljava/io/IOException; {:try_start_2c .. :try_end_30} :catch_14a
    .catchall {:try_start_2c .. :try_end_30} :catchall_141

    .line 376
    :try_start_30
    new-instance v11, Ljava/io/FileOutputStream;

    invoke-direct {v11, v2}, Ljava/io/FileOutputStream;-><init>(Ljava/io/File;)V
    :try_end_35
    .catch Ljava/io/IOException; {:try_start_30 .. :try_end_35} :catch_13b
    .catchall {:try_start_30 .. :try_end_35} :catchall_135

    .line 377
    const/16 v12, 0x2000

    :try_start_37
    new-array v12, v12, [B

    .line 378
    const-wide/16 v13, 0x0

    .line 380
    :goto_3b
    invoke-virtual {v10, v12}, Ljava/io/InputStream;->read([B)I

    move-result v15

    if-ltz v15, :cond_76

    .line 381
    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J

    move-result-wide v16
    :try_end_45
    .catch Ljava/io/IOException; {:try_start_37 .. :try_end_45} :catch_12e
    .catchall {:try_start_37 .. :try_end_45} :catchall_127

    cmp-long v16, v16, v4

    if-lez v16, :cond_55

    .line 403
    invoke-static {v11}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 404
    invoke-static {v10}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 405
    if-eqz v9, :cond_54

    invoke-virtual {v9}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 381
    :cond_54
    return v6

    .line 382
    :cond_55
    move-object/from16 v16, v8

    move-object/from16 p1, v9

    int-to-long v8, v15

    add-long/2addr v13, v8

    .line 383
    cmp-long v8, v13, p4

    if-lez v8, :cond_6b

    .line 403
    invoke-static {v11}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 404
    invoke-static {v10}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 405
    if-eqz p1, :cond_6a

    invoke-virtual/range {p1 .. p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 383
    :cond_6a
    return v6

    .line 384
    :cond_6b
    :try_start_6b
    invoke-virtual {v11, v12, v6, v15}, Ljava/io/OutputStream;->write([BII)V

    .line 385
    invoke-virtual {v7, v12, v6, v15}, Ljava/security/MessageDigest;->update([BII)V

    move-object/from16 v9, p1

    move-object/from16 v8, v16

    goto :goto_3b

    .line 387
    :cond_76
    move-object/from16 v16, v8

    move-object/from16 p1, v9

    invoke-virtual {v11}, Ljava/io/OutputStream;->flush()V

    .line 388
    invoke-static {v11}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V
    :try_end_80
    .catch Ljava/io/IOException; {:try_start_6b .. :try_end_80} :catch_125
    .catchall {:try_start_6b .. :try_end_80} :catchall_123

    .line 389
    nop

    .line 391
    cmp-long v4, v13, p4

    if-eqz v4, :cond_91

    .line 403
    invoke-static/range {v16 .. v16}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 404
    invoke-static {v10}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 405
    if-eqz p1, :cond_90

    invoke-virtual/range {p1 .. p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 391
    :cond_90
    return v6

    .line 392
    :cond_91
    :try_start_91
    invoke-virtual {v2}, Ljava/io/File;->length()J

    move-result-wide v4
    :try_end_95
    .catch Ljava/io/IOException; {:try_start_91 .. :try_end_95} :catch_11f
    .catchall {:try_start_91 .. :try_end_95} :catchall_11b

    cmp-long v4, v4, p4

    if-eqz v4, :cond_a5

    .line 403
    invoke-static/range {v16 .. v16}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 404
    invoke-static {v10}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 405
    if-eqz p1, :cond_a4

    invoke-virtual/range {p1 .. p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 392
    :cond_a4
    return v6

    .line 393
    :cond_a5
    :try_start_a5
    invoke-virtual {v7}, Ljava/security/MessageDigest;->digest()[B

    move-result-object v4

    invoke-static {v4}, Lcom/lightblitzlearning/ota/OtaPackage;->toHex([B)Ljava/lang/String;

    move-result-object v4

    move-object/from16 v5, p3

    invoke-virtual {v4, v5}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v4
    :try_end_b3
    .catch Ljava/io/IOException; {:try_start_a5 .. :try_end_b3} :catch_11f
    .catchall {:try_start_a5 .. :try_end_b3} :catchall_11b

    if-nez v4, :cond_c1

    .line 403
    invoke-static/range {v16 .. v16}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 404
    invoke-static {v10}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 405
    if-eqz p1, :cond_c0

    invoke-virtual/range {p1 .. p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 393
    :cond_c0
    return v6

    .line 394
    :cond_c1
    :try_start_c1
    invoke-direct {v1, v2}, Lcom/lightblitzlearning/ota/OtaPackage;->activationOk(Ljava/io/File;)Z

    move-result v4
    :try_end_c5
    .catch Ljava/io/IOException; {:try_start_c1 .. :try_end_c5} :catch_11f
    .catchall {:try_start_c1 .. :try_end_c5} :catchall_11b

    if-nez v4, :cond_d3

    .line 403
    invoke-static/range {v16 .. v16}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 404
    invoke-static {v10}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 405
    if-eqz p1, :cond_d2

    invoke-virtual/range {p1 .. p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 394
    :cond_d2
    return v6

    .line 396
    :cond_d3
    :try_start_d3
    new-instance v4, Ljava/io/File;

    new-instance v5, Ljava/lang/StringBuilder;

    invoke-direct {v5}, Ljava/lang/StringBuilder;-><init>()V

    const-string v7, "bundle-"

    invoke-virtual {v5, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    invoke-virtual {v5, v0}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    const-string v7, ".js"

    invoke-virtual {v5, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    invoke-virtual {v5}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v5

    invoke-direct {v4, v3, v5}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    .line 397
    invoke-virtual {v2, v4}, Ljava/io/File;->renameTo(Ljava/io/File;)Z

    move-result v2
    :try_end_f5
    .catch Ljava/io/IOException; {:try_start_d3 .. :try_end_f5} :catch_11f
    .catchall {:try_start_d3 .. :try_end_f5} :catchall_11b

    if-nez v2, :cond_103

    .line 403
    invoke-static/range {v16 .. v16}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 404
    invoke-static {v10}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 405
    if-eqz p1, :cond_102

    invoke-virtual/range {p1 .. p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 397
    :cond_102
    return v6

    .line 398
    :cond_103
    :try_start_103
    new-instance v2, Ljava/io/File;

    const-string v4, "pending"

    invoke-direct {v2, v3, v4}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-direct {v1, v2, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->writeToken(Ljava/io/File;Ljava/lang/String;)V
    :try_end_10d
    .catch Ljava/io/IOException; {:try_start_103 .. :try_end_10d} :catch_11f
    .catchall {:try_start_103 .. :try_end_10d} :catchall_11b

    .line 399
    nop

    .line 403
    invoke-static/range {v16 .. v16}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 404
    invoke-static {v10}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 405
    if-eqz p1, :cond_119

    invoke-virtual/range {p1 .. p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 399
    :cond_119
    const/4 v0, 0x1

    return v0

    .line 403
    :catchall_11b
    move-exception v0

    move-object/from16 v8, v16

    goto :goto_147

    .line 400
    :catch_11f
    move-exception v0

    move-object/from16 v8, v16

    goto :goto_150

    .line 403
    :catchall_123
    move-exception v0

    goto :goto_12a

    .line 400
    :catch_125
    move-exception v0

    goto :goto_131

    .line 403
    :catchall_127
    move-exception v0

    move-object/from16 p1, v9

    :goto_12a
    move-object/from16 v16, p1

    move-object v8, v11

    goto :goto_157

    .line 400
    :catch_12e
    move-exception v0

    move-object/from16 p1, v9

    :goto_131
    move-object/from16 v16, p1

    move-object v8, v11

    goto :goto_167

    .line 403
    :catchall_135
    move-exception v0

    move-object/from16 v16, v8

    move-object/from16 p1, v9

    goto :goto_147

    .line 400
    :catch_13b
    move-exception v0

    move-object/from16 v16, v8

    move-object/from16 p1, v9

    goto :goto_150

    .line 403
    :catchall_141
    move-exception v0

    move-object/from16 v16, v8

    move-object/from16 p1, v9

    move-object v10, v8

    :goto_147
    move-object/from16 v16, p1

    goto :goto_157

    .line 400
    :catch_14a
    move-exception v0

    move-object/from16 v16, v8

    move-object/from16 p1, v9

    move-object v10, v8

    :goto_150
    move-object/from16 v16, p1

    goto :goto_167

    .line 403
    :catchall_153
    move-exception v0

    move-object/from16 v16, v8

    move-object v10, v8

    :goto_157
    invoke-static {v8}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 404
    invoke-static {v10}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 405
    if-eqz v16, :cond_162

    invoke-virtual/range {v16 .. v16}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 406
    :cond_162
    throw v0

    .line 400
    :catch_163
    move-exception v0

    move-object/from16 v16, v8

    move-object v10, v8

    .line 401
    :goto_167
    nop

    .line 403
    invoke-static {v8}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 404
    invoke-static {v10}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 405
    if-eqz v16, :cond_173

    invoke-virtual/range {v16 .. v16}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 401
    :cond_173
    return v6

    .line 366
    :catch_174
    move-exception v0

    .line 367
    return v6
.end method

.method private gc(Ljava/io/File;)V
    .registers 18

    .line 479
    move-object/from16 v0, p0

    move-object/from16 v1, p1

    invoke-virtual {v1}, Ljava/io/File;->listFiles()[Ljava/io/File;

    move-result-object v2

    .line 480
    if-nez v2, :cond_b

    return-void

    .line 482
    :cond_b
    new-instance v3, Ljava/util/HashSet;

    invoke-direct {v3}, Ljava/util/HashSet;-><init>()V

    .line 483
    new-instance v4, Ljava/io/File;

    const-string v5, "active"

    invoke-direct {v4, v1, v5}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-direct {v0, v4}, Lcom/lightblitzlearning/ota/OtaPackage;->readToken(Ljava/io/File;)Ljava/lang/String;

    move-result-object v4

    .line 484
    new-instance v5, Ljava/io/File;

    const-string v6, "pending"

    invoke-direct {v5, v1, v6}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-direct {v0, v5}, Lcom/lightblitzlearning/ota/OtaPackage;->readToken(Ljava/io/File;)Ljava/lang/String;

    move-result-object v5

    .line 485
    if-eqz v4, :cond_2b

    invoke-interface {v3, v4}, Ljava/util/Set;->add(Ljava/lang/Object;)Z

    .line 486
    :cond_2b
    if-eqz v5, :cond_30

    invoke-interface {v3, v5}, Ljava/util/Set;->add(Ljava/lang/Object;)Z

    .line 489
    :cond_30
    nop

    .line 490
    nop

    .line 491
    array-length v4, v2

    const-wide/high16 v6, -0x8000000000000000L

    const/4 v8, 0x0

    move-object v10, v8

    move-object v11, v10

    const/4 v12, 0x0

    move-wide v8, v6

    :goto_3a
    const-string v13, "boot-ok-"

    if-ge v12, v4, :cond_81

    aget-object v14, v2, v12

    .line 492
    invoke-virtual {v14}, Ljava/io/File;->getName()Ljava/lang/String;

    move-result-object v15

    invoke-static {v15}, Lcom/lightblitzlearning/ota/OtaPackage;->bundleId(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v15

    .line 493
    if-nez v15, :cond_4b

    goto :goto_7c

    .line 494
    :cond_4b
    new-instance v5, Ljava/io/File;

    new-instance v0, Ljava/lang/StringBuilder;

    invoke-direct {v0}, Ljava/lang/StringBuilder;-><init>()V

    invoke-virtual {v0, v13}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0, v15}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-direct {v5, v1, v0}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-virtual {v5}, Ljava/io/File;->exists()Z

    move-result v0

    if-nez v0, :cond_68

    goto :goto_7c

    .line 495
    :cond_68
    invoke-virtual {v14}, Ljava/io/File;->lastModified()J

    move-result-wide v13

    .line 496
    cmp-long v0, v13, v6

    if-lez v0, :cond_76

    .line 497
    nop

    .line 498
    move-wide v8, v6

    move-object v11, v10

    move-wide v6, v13

    move-object v10, v15

    goto :goto_7c

    .line 499
    :cond_76
    cmp-long v0, v13, v8

    if-lez v0, :cond_7c

    .line 500
    move-wide v8, v13

    move-object v11, v15

    .line 491
    :cond_7c
    :goto_7c
    add-int/lit8 v12, v12, 0x1

    move-object/from16 v0, p0

    goto :goto_3a

    .line 503
    :cond_81
    if-eqz v10, :cond_86

    invoke-interface {v3, v10}, Ljava/util/Set;->add(Ljava/lang/Object;)Z

    .line 504
    :cond_86
    if-eqz v11, :cond_8b

    invoke-interface {v3, v11}, Ljava/util/Set;->add(Ljava/lang/Object;)Z

    .line 506
    :cond_8b
    array-length v0, v2

    const/4 v5, 0x0

    :goto_8d
    if-ge v5, v0, :cond_cf

    aget-object v4, v2, v5

    .line 507
    invoke-virtual {v4}, Ljava/io/File;->getName()Ljava/lang/String;

    move-result-object v6

    .line 508
    const-string v7, ".tmp"

    invoke-virtual {v6, v7}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z

    move-result v7

    if-eqz v7, :cond_a1

    .line 509
    invoke-virtual {v4}, Ljava/io/File;->delete()Z

    .line 510
    goto :goto_cc

    .line 512
    :cond_a1
    invoke-static {v6}, Lcom/lightblitzlearning/ota/OtaPackage;->bundleId(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v6

    .line 513
    if-eqz v6, :cond_cc

    invoke-interface {v3, v6}, Ljava/util/Set;->contains(Ljava/lang/Object;)Z

    move-result v7

    if-nez v7, :cond_cc

    .line 514
    invoke-virtual {v4}, Ljava/io/File;->delete()Z

    .line 515
    new-instance v4, Ljava/io/File;

    new-instance v7, Ljava/lang/StringBuilder;

    invoke-direct {v7}, Ljava/lang/StringBuilder;-><init>()V

    invoke-virtual {v7, v13}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v7

    invoke-virtual {v7, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v7

    invoke-virtual {v7}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v7

    invoke-direct {v4, v1, v7}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-virtual {v4}, Ljava/io/File;->delete()Z

    .line 516
    invoke-static {v1, v6}, Lcom/lightblitzlearning/ota/OtaPackage;->deleteAttempts(Ljava/io/File;Ljava/lang/String;)V

    .line 506
    :cond_cc
    :goto_cc
    add-int/lit8 v5, v5, 0x1

    goto :goto_8d

    .line 527
    :cond_cf
    return-void
.end method

.method private httpGet(Ljava/lang/String;Ljava/lang/String;JI)[B
    .registers 14

    .line 446
    nop

    .line 447
    nop

    .line 449
    const/4 v0, 0x0

    :try_start_3
    invoke-direct {p0, p1, p2, p3, p4}, Lcom/lightblitzlearning/ota/OtaPackage;->open(Ljava/lang/String;Ljava/lang/String;J)Ljava/net/HttpURLConnection;

    move-result-object p1
    :try_end_7
    .catch Ljava/io/IOException; {:try_start_3 .. :try_end_7} :catch_6a
    .catchall {:try_start_3 .. :try_end_7} :catchall_5f

    .line 450
    if-nez p1, :cond_12

    .line 466
    invoke-static {v0}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 467
    if-eqz p1, :cond_11

    invoke-virtual {p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 450
    :cond_11
    return-object v0

    .line 451
    :cond_12
    :try_start_12
    invoke-virtual {p1}, Ljava/net/HttpURLConnection;->getInputStream()Ljava/io/InputStream;

    move-result-object p2
    :try_end_16
    .catch Ljava/io/IOException; {:try_start_12 .. :try_end_16} :catch_5c
    .catchall {:try_start_12 .. :try_end_16} :catchall_5a

    .line 452
    :try_start_16
    new-instance v1, Ljava/io/ByteArrayOutputStream;

    invoke-direct {v1}, Ljava/io/ByteArrayOutputStream;-><init>()V

    .line 453
    const/16 v2, 0x2000

    new-array v2, v2, [B

    .line 454
    const/4 v3, 0x0

    move v4, v3

    .line 456
    :goto_21
    invoke-virtual {p2, v2}, Ljava/io/InputStream;->read([B)I

    move-result v5

    if-ltz v5, :cond_48

    .line 457
    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J

    move-result-wide v6
    :try_end_2b
    .catch Ljava/io/IOException; {:try_start_16 .. :try_end_2b} :catch_58
    .catchall {:try_start_16 .. :try_end_2b} :catchall_55

    cmp-long v6, v6, p3

    if-lez v6, :cond_38

    .line 466
    invoke-static {p2}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 467
    if-eqz p1, :cond_37

    invoke-virtual {p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 457
    :cond_37
    return-object v0

    .line 458
    :cond_38
    add-int/2addr v4, v5

    .line 459
    if-le v4, p5, :cond_44

    .line 466
    invoke-static {p2}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 467
    if-eqz p1, :cond_43

    invoke-virtual {p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 459
    :cond_43
    return-object v0

    .line 460
    :cond_44
    :try_start_44
    invoke-virtual {v1, v2, v3, v5}, Ljava/io/ByteArrayOutputStream;->write([BII)V

    goto :goto_21

    .line 462
    :cond_48
    invoke-virtual {v1}, Ljava/io/ByteArrayOutputStream;->toByteArray()[B

    move-result-object p3
    :try_end_4c
    .catch Ljava/io/IOException; {:try_start_44 .. :try_end_4c} :catch_58
    .catchall {:try_start_44 .. :try_end_4c} :catchall_55

    .line 466
    invoke-static {p2}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 467
    if-eqz p1, :cond_54

    invoke-virtual {p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 462
    :cond_54
    return-object p3

    .line 466
    :catchall_55
    move-exception p3

    move-object v0, p2

    goto :goto_61

    .line 463
    :catch_58
    move-exception p3

    goto :goto_6d

    .line 466
    :catchall_5a
    move-exception p3

    goto :goto_61

    .line 463
    :catch_5c
    move-exception p2

    move-object p2, v0

    goto :goto_6d

    .line 466
    :catchall_5f
    move-exception p3

    move-object p1, v0

    :goto_61
    invoke-static {v0}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 467
    if-eqz p1, :cond_69

    invoke-virtual {p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 468
    :cond_69
    throw p3

    .line 463
    :catch_6a
    move-exception p1

    move-object p1, v0

    move-object p2, p1

    .line 464
    :goto_6d
    nop

    .line 466
    invoke-static {p2}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 467
    if-eqz p1, :cond_76

    invoke-virtual {p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 464
    :cond_76
    return-object v0
.end method

.method private static isHex64(Ljava/lang/String;)Z
    .registers 6

    .line 629
    const/4 v0, 0x0

    if-eqz p0, :cond_2a

    invoke-virtual {p0}, Ljava/lang/String;->length()I

    move-result v1

    const/16 v2, 0x40

    if-eq v1, v2, :cond_c

    goto :goto_2a

    .line 630
    :cond_c
    move v1, v0

    :goto_d
    if-ge v1, v2, :cond_28

    .line 631
    invoke-virtual {p0, v1}, Ljava/lang/String;->charAt(I)C

    move-result v3

    .line 632
    const/16 v4, 0x30

    if-lt v3, v4, :cond_1b

    const/16 v4, 0x39

    if-le v3, v4, :cond_24

    :cond_1b
    const/16 v4, 0x61

    if-lt v3, v4, :cond_27

    const/16 v4, 0x66

    if-le v3, v4, :cond_24

    goto :goto_27

    .line 630
    :cond_24
    add-int/lit8 v1, v1, 0x1

    goto :goto_d

    .line 632
    :cond_27
    :goto_27
    return v0

    .line 634
    :cond_28
    const/4 p0, 0x1

    return p0

    .line 629
    :cond_2a
    :goto_2a
    return v0
.end method

.method private static isHttps(Ljava/lang/String;)Z
    .registers 7

    .line 639
    if-eqz p0, :cond_12

    const/4 v4, 0x0

    const/16 v5, 0x8

    const/4 v1, 0x1

    const/4 v2, 0x0

    const-string v3, "https://"

    move-object v0, p0

    invoke-virtual/range {v0 .. v5}, Ljava/lang/String;->regionMatches(ZILjava/lang/String;II)Z

    move-result p0

    if-eqz p0, :cond_12

    const/4 p0, 0x1

    goto :goto_13

    :cond_12
    const/4 p0, 0x0

    :goto_13
    return p0
.end method

.method private newestBootOk(Ljava/io/File;)Ljava/lang/String;
    .registers 13

    .line 201
    invoke-virtual {p1}, Ljava/io/File;->listFiles()[Ljava/io/File;

    move-result-object v0

    .line 202
    const/4 v1, 0x0

    if-nez v0, :cond_8

    return-object v1

    .line 203
    :cond_8
    nop

    .line 204
    nop

    .line 205
    array-length v2, v0

    const-wide/high16 v3, -0x8000000000000000L

    const/4 v5, 0x0

    :goto_e
    if-ge v5, v2, :cond_70

    aget-object v6, v0, v5

    .line 206
    invoke-virtual {v6}, Ljava/io/File;->getName()Ljava/lang/String;

    move-result-object v7

    invoke-static {v7}, Lcom/lightblitzlearning/ota/OtaPackage;->bundleId(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v7

    .line 207
    if-nez v7, :cond_1d

    goto :goto_6d

    .line 208
    :cond_1d
    new-instance v8, Ljava/io/File;

    new-instance v9, Ljava/lang/StringBuilder;

    invoke-direct {v9}, Ljava/lang/StringBuilder;-><init>()V

    const-string v10, "boot-ok-"

    invoke-virtual {v9, v10}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v9

    invoke-virtual {v9, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v9

    invoke-virtual {v9}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v9

    invoke-direct {v8, p1, v9}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-virtual {v8}, Ljava/io/File;->exists()Z

    move-result v8

    if-nez v8, :cond_3c

    goto :goto_6d

    .line 209
    :cond_3c
    new-instance v8, Ljava/io/File;

    new-instance v9, Ljava/lang/StringBuilder;

    invoke-direct {v9}, Ljava/lang/StringBuilder;-><init>()V

    const-string v10, "bad-"

    invoke-virtual {v9, v10}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v9

    invoke-virtual {v9, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v9

    invoke-virtual {v9}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v9

    invoke-direct {v8, p1, v9}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-virtual {v8}, Ljava/io/File;->exists()Z

    move-result v8

    if-eqz v8, :cond_5b

    goto :goto_6d

    .line 210
    :cond_5b
    invoke-direct {p0, v6}, Lcom/lightblitzlearning/ota/OtaPackage;->activationOk(Ljava/io/File;)Z

    move-result v8

    if-nez v8, :cond_62

    goto :goto_6d

    .line 211
    :cond_62
    invoke-virtual {v6}, Ljava/io/File;->lastModified()J

    move-result-wide v8

    .line 212
    cmp-long v6, v8, v3

    if-lez v6, :cond_6d

    .line 213
    nop

    .line 214
    move-object v1, v7

    move-wide v3, v8

    .line 205
    :cond_6d
    :goto_6d
    add-int/lit8 v5, v5, 0x1

    goto :goto_e

    .line 217
    :cond_70
    return-object v1
.end method

.method private open(Ljava/lang/String;Ljava/lang/String;J)Ljava/net/HttpURLConnection;
    .registers 10
    .annotation system Ldalvik/annotation/Throws;
        value = {
            Ljava/io/IOException;
        }
    .end annotation

    .line 416
    const/4 v0, 0x0

    move v1, v0

    .line 418
    :goto_2
    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J

    move-result-wide v2

    cmp-long v2, v2, p3

    const/4 v3, 0x0

    if-lez v2, :cond_c

    return-object v3

    .line 419
    :cond_c
    invoke-static {p1}, Lcom/lightblitzlearning/ota/OtaPackage;->isHttps(Ljava/lang/String;)Z

    move-result v2

    if-nez v2, :cond_13

    return-object v3

    .line 420
    :cond_13
    new-instance v2, Ljava/net/URL;

    invoke-direct {v2, p1}, Ljava/net/URL;-><init>(Ljava/lang/String;)V

    invoke-virtual {v2}, Ljava/net/URL;->openConnection()Ljava/net/URLConnection;

    move-result-object p1

    check-cast p1, Ljava/net/HttpURLConnection;

    .line 421
    invoke-virtual {p1, v0}, Ljava/net/HttpURLConnection;->setInstanceFollowRedirects(Z)V

    .line 422
    const/16 v2, 0x2710

    invoke-virtual {p1, v2}, Ljava/net/HttpURLConnection;->setConnectTimeout(I)V

    .line 423
    const/16 v2, 0x7530

    invoke-virtual {p1, v2}, Ljava/net/HttpURLConnection;->setReadTimeout(I)V

    .line 424
    const-string v2, "GET"

    invoke-virtual {p1, v2}, Ljava/net/HttpURLConnection;->setRequestMethod(Ljava/lang/String;)V

    .line 425
    new-instance v2, Ljava/lang/StringBuilder;

    invoke-direct {v2}, Ljava/lang/StringBuilder;-><init>()V

    const-string v4, "Bearer "

    invoke-virtual {v2, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2, p2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v2

    const-string v4, "Authorization"

    invoke-virtual {p1, v4, v2}, Ljava/net/HttpURLConnection;->setRequestProperty(Ljava/lang/String;Ljava/lang/String;)V

    .line 427
    invoke-virtual {p1}, Ljava/net/HttpURLConnection;->connect()V

    .line 428
    invoke-virtual {p1}, Ljava/net/HttpURLConnection;->getResponseCode()I

    move-result v2

    .line 429
    const/16 v4, 0xc8

    if-ne v2, v4, :cond_54

    .line 430
    return-object p1

    .line 432
    :cond_54
    const/16 v4, 0x12d

    if-eq v2, v4, :cond_6d

    const/16 v4, 0x12e

    if-eq v2, v4, :cond_6d

    const/16 v4, 0x12f

    if-eq v2, v4, :cond_6d

    const/16 v4, 0x133

    if-eq v2, v4, :cond_6d

    const/16 v4, 0x134

    if-ne v2, v4, :cond_69

    goto :goto_6d

    .line 439
    :cond_69
    invoke-virtual {p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 440
    return-object v3

    .line 433
    :cond_6d
    :goto_6d
    const-string v2, "Location"

    invoke-virtual {p1, v2}, Ljava/net/HttpURLConnection;->getHeaderField(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v2

    .line 434
    invoke-virtual {p1}, Ljava/net/HttpURLConnection;->disconnect()V

    .line 435
    if-eqz v2, :cond_81

    add-int/lit8 v1, v1, 0x1

    const/4 p1, 0x5

    if-le v1, p1, :cond_7e

    goto :goto_81

    .line 436
    :cond_7e
    nop

    .line 437
    move-object p1, v2

    goto :goto_2

    .line 435
    :cond_81
    :goto_81
    return-object v3
.end method

.method private parseCurrent([B)[Ljava/lang/String;
    .registers 11

    .line 338
    const-string v0, "size"

    const/4 v1, 0x0

    :try_start_3
    new-instance v2, Lorg/json/JSONObject;

    new-instance v3, Ljava/lang/String;

    sget-object v4, Ljava/nio/charset/StandardCharsets;->UTF_8:Ljava/nio/charset/Charset;

    invoke-direct {v3, p1, v4}, Ljava/lang/String;-><init>([BLjava/nio/charset/Charset;)V

    invoke-direct {v2, v3}, Lorg/json/JSONObject;-><init>(Ljava/lang/String;)V

    .line 339
    invoke-virtual {v2, v0}, Lorg/json/JSONObject;->has(Ljava/lang/String;)Z

    move-result p1

    if-nez p1, :cond_16

    return-object v1

    .line 340
    :cond_16
    const-string p1, "buildId"

    invoke-virtual {v2, p1, v1}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    .line 341
    const-string v3, "url"

    invoke-virtual {v2, v3, v1}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v3

    .line 342
    const-string v4, "sha256"

    invoke-virtual {v2, v4, v1}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v4

    .line 343
    const-wide/16 v5, -0x1

    invoke-virtual {v2, v0, v5, v6}, Lorg/json/JSONObject;->optLong(Ljava/lang/String;J)J

    move-result-wide v5

    .line 344
    if-eqz p1, :cond_62

    if-eqz v3, :cond_62

    if-nez v4, :cond_35

    goto :goto_62

    .line 345
    :cond_35
    invoke-static {p1}, Lcom/lightblitzlearning/ota/OtaPackage;->validId(Ljava/lang/String;)Z

    move-result v0

    if-nez v0, :cond_3c

    return-object v1

    .line 346
    :cond_3c
    invoke-static {v3}, Lcom/lightblitzlearning/ota/OtaPackage;->isHttps(Ljava/lang/String;)Z

    move-result v0

    if-nez v0, :cond_43

    return-object v1

    .line 347
    :cond_43
    invoke-static {v4}, Lcom/lightblitzlearning/ota/OtaPackage;->isHex64(Ljava/lang/String;)Z

    move-result v0

    if-nez v0, :cond_4a

    return-object v1

    .line 348
    :cond_4a
    const-wide/16 v7, 0x0

    cmp-long v0, v5, v7

    if-lez v0, :cond_61

    const-wide/32 v7, 0x4000000

    cmp-long v0, v5, v7

    if-lez v0, :cond_58

    goto :goto_61

    .line 349
    :cond_58
    invoke-static {v5, v6}, Ljava/lang/Long;->toString(J)Ljava/lang/String;

    move-result-object v0

    filled-new-array {p1, v3, v4, v0}, [Ljava/lang/String;

    move-result-object p1
    :try_end_60
    .catchall {:try_start_3 .. :try_end_60} :catchall_63

    return-object p1

    .line 348
    :cond_61
    :goto_61
    return-object v1

    .line 344
    :cond_62
    :goto_62
    return-object v1

    .line 350
    :catchall_63
    move-exception p1

    .line 351
    return-object v1
.end method

.method private static readAllBytes(Ljava/io/File;I)[B
    .registers 7
    .annotation system Ldalvik/annotation/Throws;
        value = {
            Ljava/io/IOException;
        }
    .end annotation

    .line 593
    nop

    .line 595
    const/4 v0, 0x0

    :try_start_2
    new-instance v1, Ljava/io/FileInputStream;

    invoke-direct {v1, p0}, Ljava/io/FileInputStream;-><init>(Ljava/io/File;)V
    :try_end_7
    .catchall {:try_start_2 .. :try_end_7} :catchall_2b

    .line 596
    :try_start_7
    new-instance p0, Ljava/io/ByteArrayOutputStream;

    invoke-direct {p0}, Ljava/io/ByteArrayOutputStream;-><init>()V

    .line 597
    const/16 v0, 0x1000

    new-array v0, v0, [B

    .line 598
    const/4 v2, 0x0

    move v3, v2

    .line 600
    :goto_12
    invoke-virtual {v1, v0}, Ljava/io/InputStream;->read([B)I

    move-result v4

    if-ltz v4, :cond_20

    .line 601
    add-int/2addr v3, v4

    .line 602
    if-le v3, p1, :cond_1c

    goto :goto_20

    .line 603
    :cond_1c
    invoke-virtual {p0, v0, v2, v4}, Ljava/io/ByteArrayOutputStream;->write([BII)V

    goto :goto_12

    .line 605
    :cond_20
    :goto_20
    invoke-virtual {p0}, Ljava/io/ByteArrayOutputStream;->toByteArray()[B

    move-result-object p0
    :try_end_24
    .catchall {:try_start_7 .. :try_end_24} :catchall_28

    .line 607
    invoke-static {v1}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 605
    return-object p0

    .line 607
    :catchall_28
    move-exception p0

    move-object v0, v1

    goto :goto_2c

    :catchall_2b
    move-exception p0

    :goto_2c
    invoke-static {v0}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 608
    throw p0
.end method

.method private readConfig(Ljava/io/File;)[Ljava/lang/String;
    .registers 6

    .line 316
    new-instance v0, Ljava/io/File;

    const-string v1, "config.json"

    invoke-direct {v0, p1, v1}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    .line 317
    invoke-virtual {v0}, Ljava/io/File;->isFile()Z

    move-result p1

    const/4 v1, 0x0

    if-nez p1, :cond_f

    return-object v1

    .line 319
    :cond_f
    const/high16 p1, 0x10000

    :try_start_11
    invoke-static {v0, p1}, Lcom/lightblitzlearning/ota/OtaPackage;->readAllBytes(Ljava/io/File;I)[B

    move-result-object p1

    .line 320
    if-nez p1, :cond_18

    return-object v1

    .line 321
    :cond_18
    new-instance v0, Lorg/json/JSONObject;

    new-instance v2, Ljava/lang/String;

    sget-object v3, Ljava/nio/charset/StandardCharsets;->UTF_8:Ljava/nio/charset/Charset;

    invoke-direct {v2, p1, v3}, Ljava/lang/String;-><init>([BLjava/nio/charset/Charset;)V

    invoke-direct {v0, v2}, Lorg/json/JSONObject;-><init>(Ljava/lang/String;)V

    .line 322
    const-string p1, "url"

    invoke-virtual {v0, p1, v1}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    .line 323
    const-string v2, "token"

    invoke-virtual {v0, v2, v1}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v0

    .line 324
    if-eqz p1, :cond_41

    if-nez v0, :cond_35

    goto :goto_41

    .line 325
    :cond_35
    invoke-static {p1}, Lcom/lightblitzlearning/ota/OtaPackage;->isHttps(Ljava/lang/String;)Z

    move-result v2

    if-nez v2, :cond_3c

    return-object v1

    .line 326
    :cond_3c
    filled-new-array {p1, v0}, [Ljava/lang/String;

    move-result-object p1
    :try_end_40
    .catchall {:try_start_11 .. :try_end_40} :catchall_42

    return-object p1

    .line 324
    :cond_41
    :goto_41
    return-object v1

    .line 327
    :catchall_42
    move-exception p1

    .line 328
    return-object v1
.end method

.method private readToken(Ljava/io/File;)Ljava/lang/String;
    .registers 5

    .line 540
    invoke-virtual {p1}, Ljava/io/File;->isFile()Z

    move-result v0

    const/4 v1, 0x0

    if-nez v0, :cond_8

    return-object v1

    .line 542
    :cond_8
    const/16 v0, 0x80

    :try_start_a
    invoke-static {p1, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->readAllBytes(Ljava/io/File;I)[B

    move-result-object p1

    .line 543
    if-nez p1, :cond_11

    return-object v1

    .line 544
    :cond_11
    new-instance v0, Ljava/lang/String;

    sget-object v2, Ljava/nio/charset/StandardCharsets;->UTF_8:Ljava/nio/charset/Charset;

    invoke-direct {v0, p1, v2}, Ljava/lang/String;-><init>([BLjava/nio/charset/Charset;)V

    invoke-virtual {v0}, Ljava/lang/String;->trim()Ljava/lang/String;

    move-result-object p1

    .line 545
    invoke-static {p1}, Lcom/lightblitzlearning/ota/OtaPackage;->validId(Ljava/lang/String;)Z

    move-result v0
    :try_end_20
    .catch Ljava/io/IOException; {:try_start_a .. :try_end_20} :catch_24

    if-eqz v0, :cond_23

    move-object v1, p1

    :cond_23
    return-object v1

    .line 546
    :catch_24
    move-exception p1

    .line 547
    return-object v1
.end method

.method private refresh(Ljava/io/File;)V
    .registers 17

    .line 273
    move-object/from16 v8, p1

    .line 274
    nop

    .line 275
    invoke-direct/range {p0 .. p1}, Lcom/lightblitzlearning/ota/OtaPackage;->readConfig(Ljava/io/File;)[Ljava/lang/String;

    move-result-object v0

    .line 276
    const/4 v1, 0x1

    const/4 v2, 0x0

    if-eqz v0, :cond_12

    .line 277
    aget-object v3, v0, v2

    .line 278
    aget-object v0, v0, v1

    move-object v11, v0

    move-object v10, v3

    goto :goto_18

    .line 276
    :cond_12
    const-string v3, "__MJOLNIR_OTA_URL__"

    const-string v0, "__MJOLNIR_OTA_TOKEN__"

    move-object v11, v0

    move-object v10, v3

    .line 280
    :goto_18
    invoke-static {v10}, Lcom/lightblitzlearning/ota/OtaPackage;->isHttps(Ljava/lang/String;)Z

    move-result v0

    if-nez v0, :cond_1f

    return-void

    .line 282
    :cond_1f
    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J

    move-result-wide v3

    const-wide/32 v5, 0x1d4c0

    add-long v12, v3, v5

    .line 284
    const/high16 v14, 0x100000

    move-object v9, p0

    invoke-direct/range {v9 .. v14}, Lcom/lightblitzlearning/ota/OtaPackage;->httpGet(Ljava/lang/String;Ljava/lang/String;JI)[B

    move-result-object v0

    .line 285
    if-nez v0, :cond_32

    return-void

    .line 287
    :cond_32
    invoke-direct {p0, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->parseCurrent([B)[Ljava/lang/String;

    move-result-object v0

    .line 288
    if-nez v0, :cond_39

    return-void

    .line 289
    :cond_39
    aget-object v6, v0, v2

    .line 290
    aget-object v1, v0, v1

    .line 291
    const/4 v2, 0x2

    aget-object v3, v0, v2

    .line 292
    const/4 v2, 0x3

    aget-object v0, v0, v2

    invoke-static {v0}, Ljava/lang/Long;->parseLong(Ljava/lang/String;)J

    move-result-wide v4

    .line 303
    new-instance v0, Ljava/io/File;

    new-instance v2, Ljava/lang/StringBuilder;

    invoke-direct {v2}, Ljava/lang/StringBuilder;-><init>()V

    const-string v7, "bundle-"

    invoke-virtual {v2, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v10, ".js"

    invoke-virtual {v2, v10}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v2

    invoke-direct {v0, v8, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-virtual {v0}, Ljava/io/File;->isFile()Z

    move-result v0

    if-nez v0, :cond_b4

    new-instance v0, Ljava/io/File;

    new-instance v2, Ljava/lang/StringBuilder;

    invoke-direct {v2}, Ljava/lang/StringBuilder;-><init>()V

    const-string v10, "bad-"

    invoke-virtual {v2, v10}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v2

    invoke-direct {v0, v8, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    .line 304
    invoke-virtual {v0}, Ljava/io/File;->exists()Z

    move-result v0

    if-eqz v0, :cond_8a

    goto :goto_b4

    .line 308
    :cond_8a
    new-instance v0, Ljava/io/File;

    new-instance v2, Ljava/lang/StringBuilder;

    invoke-direct {v2}, Ljava/lang/StringBuilder;-><init>()V

    invoke-virtual {v2, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v7, ".js.tmp"

    invoke-virtual {v2, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v2

    invoke-direct {v0, v8, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    .line 309
    move-object v7, v0

    move-object v2, v11

    move-wide v9, v12

    move-object v0, p0

    invoke-direct/range {v0 .. v10}, Lcom/lightblitzlearning/ota/OtaPackage;->download(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;JLjava/lang/String;Ljava/io/File;Ljava/io/File;J)Z

    move-result v1

    if-nez v1, :cond_b3

    .line 310
    invoke-virtual {v7}, Ljava/io/File;->delete()Z

    .line 312
    :cond_b3
    return-void

    .line 305
    :cond_b4
    :goto_b4
    return-void
.end method

.method private selectBundle(Ljava/io/File;)Ljava/lang/String;
    .registers 6

    .line 142
    new-instance v0, Ljava/io/File;

    const-string v1, "pending"

    invoke-direct {v0, p1, v1}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-direct {p0, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->readToken(Ljava/io/File;)Ljava/lang/String;

    move-result-object v0

    .line 143
    const-string v2, "active"

    if-eqz v0, :cond_2c

    invoke-direct {p0, p1, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->usable(Ljava/io/File;Ljava/lang/String;)Z

    move-result v3

    if-eqz v3, :cond_2c

    .line 144
    new-instance v3, Ljava/io/File;

    invoke-direct {v3, p1, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-direct {p0, v3, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->writeToken(Ljava/io/File;Ljava/lang/String;)V

    .line 145
    new-instance v2, Ljava/io/File;

    invoke-direct {v2, p1, v1}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-virtual {v2}, Ljava/io/File;->delete()Z

    .line 146
    iput-object v1, p0, Lcom/lightblitzlearning/ota/OtaPackage;->lastTier:Ljava/lang/String;

    .line 147
    invoke-direct {p0, p1, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->commit(Ljava/io/File;Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    .line 151
    :cond_2c
    new-instance v0, Ljava/io/File;

    invoke-direct {v0, p1, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-direct {p0, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->readToken(Ljava/io/File;)Ljava/lang/String;

    move-result-object v0

    .line 152
    if-eqz v0, :cond_44

    invoke-direct {p0, p1, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->usable(Ljava/io/File;Ljava/lang/String;)Z

    move-result v1

    if-eqz v1, :cond_44

    .line 153
    iput-object v2, p0, Lcom/lightblitzlearning/ota/OtaPackage;->lastTier:Ljava/lang/String;

    .line 154
    invoke-direct {p0, p1, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->commit(Ljava/io/File;Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    .line 158
    :cond_44
    invoke-direct {p0, p1}, Lcom/lightblitzlearning/ota/OtaPackage;->newestBootOk(Ljava/io/File;)Ljava/lang/String;

    move-result-object v0

    .line 159
    if-eqz v0, :cond_5b

    .line 160
    new-instance v1, Ljava/io/File;

    invoke-direct {v1, p1, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-direct {p0, v1, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->writeToken(Ljava/io/File;Ljava/lang/String;)V

    .line 161
    const-string v1, "boot-ok"

    iput-object v1, p0, Lcom/lightblitzlearning/ota/OtaPackage;->lastTier:Ljava/lang/String;

    .line 162
    invoke-direct {p0, p1, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->commit(Ljava/io/File;Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    .line 168
    :cond_5b
    new-instance v0, Ljava/io/File;

    invoke-direct {v0, p1, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-virtual {v0}, Ljava/io/File;->delete()Z

    .line 169
    const-string p1, "asset"

    iput-object p1, p0, Lcom/lightblitzlearning/ota/OtaPackage;->lastTier:Ljava/lang/String;

    .line 170
    const/4 p1, 0x0

    return-object p1
.end method

.method private startDaemon()V
    .registers 3

    .line 246
    new-instance v0, Ljava/lang/Thread;

    invoke-direct {v0, p0}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;)V

    .line 247
    const/4 v1, 0x1

    invoke-virtual {v0, v1}, Ljava/lang/Thread;->setDaemon(Z)V

    .line 248
    invoke-virtual {v0}, Ljava/lang/Thread;->start()V

    .line 249
    return-void
.end method

.method private static toHex([B)Ljava/lang/String;
    .registers 7

    .line 643
    const-string v0, "0123456789abcdef"

    invoke-virtual {v0}, Ljava/lang/String;->toCharArray()[C

    move-result-object v0

    .line 644
    array-length v1, p0

    mul-int/lit8 v1, v1, 0x2

    new-array v1, v1, [C

    .line 645
    const/4 v2, 0x0

    :goto_c
    array-length v3, p0

    if-ge v2, v3, :cond_26

    .line 646
    aget-byte v3, p0, v2

    and-int/lit16 v3, v3, 0xff

    .line 647
    mul-int/lit8 v4, v2, 0x2

    ushr-int/lit8 v5, v3, 0x4

    aget-char v5, v0, v5

    aput-char v5, v1, v4

    .line 648
    add-int/lit8 v4, v4, 0x1

    and-int/lit8 v3, v3, 0xf

    aget-char v3, v0, v3

    aput-char v3, v1, v4

    .line 645
    add-int/lit8 v2, v2, 0x1

    goto :goto_c

    .line 650
    :cond_26
    new-instance p0, Ljava/lang/String;

    invoke-direct {p0, v1}, Ljava/lang/String;-><init>([C)V

    return-object p0
.end method

.method private static touch(Ljava/io/File;)V
    .registers 2

    .line 586
    :try_start_0
    new-instance v0, Ljava/io/FileOutputStream;

    invoke-direct {v0, p0}, Ljava/io/FileOutputStream;-><init>(Ljava/io/File;)V

    invoke-virtual {v0}, Ljava/io/FileOutputStream;->close()V
    :try_end_8
    .catch Ljava/io/IOException; {:try_start_0 .. :try_end_8} :catch_9

    .line 589
    goto :goto_a

    .line 587
    :catch_9
    move-exception p0

    .line 590
    :goto_a
    return-void
.end method

.method private usable(Ljava/io/File;Ljava/lang/String;)Z
    .registers 9

    .line 179
    new-instance v0, Ljava/io/File;

    new-instance v1, Ljava/lang/StringBuilder;

    invoke-direct {v1}, Ljava/lang/StringBuilder;-><init>()V

    const-string v2, "bundle-"

    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v1

    invoke-virtual {v1, p2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v1

    const-string v2, ".js"

    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v1

    invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v1

    invoke-direct {v0, p1, v1}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    .line 180
    invoke-virtual {v0}, Ljava/io/File;->isFile()Z

    move-result v1

    const/4 v2, 0x0

    if-nez v1, :cond_26

    return v2

    .line 181
    :cond_26
    new-instance v1, Ljava/io/File;

    new-instance v3, Ljava/lang/StringBuilder;

    invoke-direct {v3}, Ljava/lang/StringBuilder;-><init>()V

    const-string v4, "bad-"

    invoke-virtual {v3, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v3

    invoke-virtual {v3, p2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v3

    invoke-virtual {v3}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v3

    invoke-direct {v1, p1, v3}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-virtual {v1}, Ljava/io/File;->exists()Z

    move-result v1

    if-eqz v1, :cond_45

    return v2

    .line 182
    :cond_45
    new-instance v1, Ljava/io/File;

    new-instance v3, Ljava/lang/StringBuilder;

    invoke-direct {v3}, Ljava/lang/StringBuilder;-><init>()V

    const-string v5, "boot-ok-"

    invoke-virtual {v3, v5}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v3

    invoke-virtual {v3, p2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v3

    invoke-virtual {v3}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v3

    invoke-direct {v1, p1, v3}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-virtual {v1}, Ljava/io/File;->exists()Z

    move-result v1

    if-nez v1, :cond_84

    invoke-static {p1, p2}, Lcom/lightblitzlearning/ota/OtaPackage;->countAttempts(Ljava/io/File;Ljava/lang/String;)I

    move-result v1

    const/4 v3, 0x2

    if-lt v1, v3, :cond_84

    .line 183
    new-instance v0, Ljava/io/File;

    new-instance v1, Ljava/lang/StringBuilder;

    invoke-direct {v1}, Ljava/lang/StringBuilder;-><init>()V

    invoke-virtual {v1, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v1

    invoke-virtual {v1, p2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object p2

    invoke-virtual {p2}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object p2

    invoke-direct {v0, p1, p2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    invoke-static {v0}, Lcom/lightblitzlearning/ota/OtaPackage;->touch(Ljava/io/File;)V

    .line 184
    return v2

    .line 186
    :cond_84
    invoke-direct {p0, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->activationOk(Ljava/io/File;)Z

    move-result p1

    return p1
.end method

.method private static validId(Ljava/lang/String;)Z
    .registers 7

    .line 615
    const/4 v0, 0x0

    if-nez p0, :cond_4

    return v0

    .line 616
    :cond_4
    invoke-virtual {p0}, Ljava/lang/String;->length()I

    move-result v1

    .line 617
    const/4 v2, 0x1

    if-lt v1, v2, :cond_46

    const/16 v3, 0x40

    if-le v1, v3, :cond_10

    goto :goto_46

    .line 618
    :cond_10
    move v3, v0

    :goto_11
    if-ge v3, v1, :cond_45

    .line 619
    invoke-virtual {p0, v3}, Ljava/lang/String;->charAt(I)C

    move-result v4

    .line 620
    const/16 v5, 0x41

    if-lt v4, v5, :cond_1f

    const/16 v5, 0x5a

    if-le v4, v5, :cond_3e

    :cond_1f
    const/16 v5, 0x61

    if-lt v4, v5, :cond_27

    const/16 v5, 0x7a

    if-le v4, v5, :cond_3e

    :cond_27
    const/16 v5, 0x30

    if-lt v4, v5, :cond_2f

    const/16 v5, 0x39

    if-le v4, v5, :cond_3e

    :cond_2f
    const/16 v5, 0x2e

    if-eq v4, v5, :cond_3e

    const/16 v5, 0x5f

    if-eq v4, v5, :cond_3e

    const/16 v5, 0x2d

    if-ne v4, v5, :cond_3c

    goto :goto_3e

    :cond_3c
    move v4, v0

    goto :goto_3f

    :cond_3e
    :goto_3e
    move v4, v2

    .line 622
    :goto_3f
    if-nez v4, :cond_42

    return v0

    .line 618
    :cond_42
    add-int/lit8 v3, v3, 0x1

    goto :goto_11

    .line 624
    :cond_45
    return v2

    .line 617
    :cond_46
    :goto_46
    return v0
.end method

.method private writeToken(Ljava/io/File;Ljava/lang/String;)V
    .registers 7

    .line 553
    new-instance v0, Ljava/io/File;

    invoke-virtual {p1}, Ljava/io/File;->getParentFile()Ljava/io/File;

    move-result-object v1

    new-instance v2, Ljava/lang/StringBuilder;

    invoke-direct {v2}, Ljava/lang/StringBuilder;-><init>()V

    invoke-virtual {p1}, Ljava/io/File;->getName()Ljava/lang/String;

    move-result-object v3

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v3, ".tmp"

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v2

    invoke-direct {v0, v1, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    .line 554
    nop

    .line 556
    const/4 v1, 0x0

    :try_start_22
    new-instance v2, Ljava/io/FileOutputStream;

    invoke-direct {v2, v0}, Ljava/io/FileOutputStream;-><init>(Ljava/io/File;)V
    :try_end_27
    .catch Ljava/io/IOException; {:try_start_22 .. :try_end_27} :catch_49
    .catchall {:try_start_22 .. :try_end_27} :catchall_47

    .line 557
    :try_start_27
    sget-object v3, Ljava/nio/charset/StandardCharsets;->UTF_8:Ljava/nio/charset/Charset;

    invoke-virtual {p2, v3}, Ljava/lang/String;->getBytes(Ljava/nio/charset/Charset;)[B

    move-result-object p2

    invoke-virtual {v2, p2}, Ljava/io/OutputStream;->write([B)V

    .line 558
    invoke-virtual {v2}, Ljava/io/OutputStream;->flush()V

    .line 559
    invoke-static {v2}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V
    :try_end_36
    .catch Ljava/io/IOException; {:try_start_27 .. :try_end_36} :catch_44
    .catchall {:try_start_27 .. :try_end_36} :catchall_41

    .line 560
    nop

    .line 561
    :try_start_37
    invoke-virtual {v0, p1}, Ljava/io/File;->renameTo(Ljava/io/File;)Z

    move-result p1

    if-nez p1, :cond_4d

    invoke-virtual {v0}, Ljava/io/File;->delete()Z
    :try_end_40
    .catch Ljava/io/IOException; {:try_start_37 .. :try_end_40} :catch_49
    .catchall {:try_start_37 .. :try_end_40} :catchall_47

    goto :goto_4d

    .line 565
    :catchall_41
    move-exception p1

    move-object v1, v2

    goto :goto_52

    .line 562
    :catch_44
    move-exception p1

    move-object v1, v2

    goto :goto_4a

    .line 565
    :catchall_47
    move-exception p1

    goto :goto_52

    .line 562
    :catch_49
    move-exception p1

    .line 563
    :goto_4a
    :try_start_4a
    invoke-virtual {v0}, Ljava/io/File;->delete()Z
    :try_end_4d
    .catchall {:try_start_4a .. :try_end_4d} :catchall_47

    .line 565
    :cond_4d
    :goto_4d
    invoke-static {v1}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 566
    nop

    .line 567
    return-void

    .line 565
    :goto_52
    invoke-static {v1}, Lcom/lightblitzlearning/ota/OtaPackage;->closeQuietly(Ljava/io/Closeable;)V

    .line 566
    throw p1
.end method


# virtual methods
.method public createApplicationLifecycleListeners(Landroid/content/Context;)Ljava/util/List;
    .registers 2

    .line 74
    invoke-static {}, Ljava/util/Collections;->emptyList()Ljava/util/List;

    move-result-object p1

    return-object p1
.end method

.method public createInternalModules(Landroid/content/Context;)Ljava/util/List;
    .registers 2

    .line 75
    invoke-static {}, Ljava/util/Collections;->emptyList()Ljava/util/List;

    move-result-object p1

    return-object p1
.end method

.method public createReactActivityHandlers(Landroid/content/Context;)Ljava/util/List;
    .registers 2

    .line 76
    invoke-static {}, Ljava/util/Collections;->emptyList()Ljava/util/List;

    move-result-object p1

    return-object p1
.end method

.method public createReactActivityLifecycleListeners(Landroid/content/Context;)Ljava/util/List;
    .registers 2

    .line 77
    invoke-static {}, Ljava/util/Collections;->emptyList()Ljava/util/List;

    move-result-object p1

    return-object p1
.end method

.method public createReactNativeHostHandlers(Landroid/content/Context;)Ljava/util/List;
    .registers 2

    .line 82
    invoke-virtual {p1}, Landroid/content/Context;->getApplicationContext()Landroid/content/Context;

    move-result-object p1

    iput-object p1, p0, Lcom/lightblitzlearning/ota/OtaPackage;->ctx:Landroid/content/Context;

    .line 83
    invoke-static {p0}, Ljava/util/Collections;->singletonList(Ljava/lang/Object;)Ljava/util/List;

    move-result-object p1

    return-object p1
.end method

.method public createSingletonModules(Landroid/content/Context;)Ljava/util/List;
    .registers 2

    .line 78
    invoke-static {}, Ljava/util/Collections;->emptyList()Ljava/util/List;

    move-result-object p1

    return-object p1
.end method

.method public getBundleAssetName(Z)Ljava/lang/String;
    .registers 2

    .line 91
    const/4 p1, 0x0

    return-object p1
.end method

.method public getDevSupportManagerFactory()Ljava/lang/Object;
    .registers 2

    .line 92
    const/4 v0, 0x0

    return-object v0
.end method

.method public getJSBundleFile(Z)Ljava/lang/String;
    .registers 5

    .line 114
    const-string v0, "mjolnir-ota"

    const/4 v1, 0x0

    if-eqz p1, :cond_6

    .line 115
    return-object v1

    .line 117
    :cond_6
    nop

    .line 119
    :try_start_7
    new-instance p1, Ljava/io/File;

    iget-object v2, p0, Lcom/lightblitzlearning/ota/OtaPackage;->ctx:Landroid/content/Context;

    invoke-virtual {v2}, Landroid/content/Context;->getFilesDir()Ljava/io/File;

    move-result-object v2

    invoke-direct {p1, v2, v0}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    .line 120
    invoke-virtual {p1}, Ljava/io/File;->mkdirs()Z

    .line 121
    invoke-direct {p0, p1}, Lcom/lightblitzlearning/ota/OtaPackage;->selectBundle(Ljava/io/File;)Ljava/lang/String;

    move-result-object p1

    .line 122
    invoke-direct {p0}, Lcom/lightblitzlearning/ota/OtaPackage;->startDaemon()V
    :try_end_1c
    .catchall {:try_start_7 .. :try_end_1c} :catchall_1e

    .line 125
    move-object v1, p1

    goto :goto_20

    .line 123
    :catchall_1e
    move-exception p1

    .line 124
    nop

    .line 128
    :goto_20
    new-instance p1, Ljava/lang/StringBuilder;

    invoke-direct {p1}, Ljava/lang/StringBuilder;-><init>()V

    const-string v2, "select tier="

    invoke-virtual {p1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object p1

    iget-object v2, p0, Lcom/lightblitzlearning/ota/OtaPackage;->lastTier:Ljava/lang/String;

    invoke-virtual {p1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object p1

    const-string v2, " path="

    invoke-virtual {p1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object p1

    invoke-virtual {p1, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object p1

    invoke-virtual {p1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object p1

    invoke-static {v0, p1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    .line 129
    return-object v1
.end method

.method public getJavaScriptExecutorFactory()Lcom/facebook/react/bridge/JavaScriptExecutorFactory;
    .registers 2

    .line 93
    const/4 v0, 0x0

    return-object v0
.end method

.method public getUseDeveloperSupport()Ljava/lang/Boolean;
    .registers 2

    .line 94
    const/4 v0, 0x0

    return-object v0
.end method

.method public onDidCreateDevSupportManager(Lcom/facebook/react/devsupport/interfaces/DevSupportManager;)V
    .registers 2

    .line 95
    return-void
.end method

.method public onDidCreateReactInstance(ZLcom/facebook/react/bridge/ReactContext;)V
    .registers 3

    .line 96
    return-void
.end method

.method public onReactInstanceException(ZLjava/lang/Exception;)V
    .registers 3

    .line 97
    return-void
.end method

.method public onWillCreateReactInstance(Z)V
    .registers 2

    .line 98
    return-void
.end method

.method public run()V
    .registers 4

    .line 254
    :try_start_0
    new-instance v0, Ljava/io/File;

    iget-object v1, p0, Lcom/lightblitzlearning/ota/OtaPackage;->ctx:Landroid/content/Context;

    invoke-virtual {v1}, Landroid/content/Context;->getFilesDir()Ljava/io/File;

    move-result-object v1

    const-string v2, "mjolnir-ota"

    invoke-direct {v0, v1, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V
    :try_end_d
    .catchall {:try_start_0 .. :try_end_d} :catchall_18

    .line 256
    :try_start_d
    invoke-direct {p0, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->refresh(Ljava/io/File;)V
    :try_end_10
    .catchall {:try_start_d .. :try_end_10} :catchall_11

    .line 258
    goto :goto_12

    .line 257
    :catchall_11
    move-exception v1

    .line 260
    :goto_12
    :try_start_12
    invoke-direct {p0, v0}, Lcom/lightblitzlearning/ota/OtaPackage;->gc(Ljava/io/File;)V
    :try_end_15
    .catchall {:try_start_12 .. :try_end_15} :catchall_16

    .line 262
    goto :goto_17

    .line 261
    :catchall_16
    move-exception v0

    .line 264
    :goto_17
    goto :goto_19

    .line 263
    :catchall_18
    move-exception v0

    .line 265
    :goto_19
    return-void
.end method
