package org.punetrees.app.core.image

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.File

object ImageUtils {

    fun processImageUri(context: Context, uri: Uri): Pair<Bitmap, String>? {
        return try {
            val imagesDir = File(context.cacheDir, "picked_images").apply { mkdirs() }
            val tempFile = File(imagesDir, "gallery_${System.currentTimeMillis()}.jpg")
            context.contentResolver.openInputStream(uri)?.use { input ->
                tempFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
            processImageFile(tempFile)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun processImageFile(file: File): Pair<Bitmap, String>? {
        return try {
            val exif = ExifInterface(file.absolutePath)
            val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_UNDEFINED)

            val boundsOptions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.absolutePath, boundsOptions)
            val origWidth = boundsOptions.outWidth
            val origHeight = boundsOptions.outHeight

            val maxDim = 1280
            var sampleSize = 1
            while ((origWidth / sampleSize) > maxDim * 1.5 || (origHeight / sampleSize) > maxDim * 1.5) {
                sampleSize *= 2
            }

            val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
            val sampledBitmap = BitmapFactory.decodeFile(file.absolutePath, decodeOptions) ?: return null

            val matrix = Matrix()
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            }

            val rotatedBitmap = if (!matrix.isIdentity) {
                Bitmap.createBitmap(sampledBitmap, 0, 0, sampledBitmap.width, sampledBitmap.height, matrix, true)
            } else {
                sampledBitmap
            }

            val scaledBitmap = if (rotatedBitmap.width > maxDim || rotatedBitmap.height > maxDim) {
                val scale = maxDim.toFloat() / maxOf(rotatedBitmap.width, rotatedBitmap.height)
                Bitmap.createScaledBitmap(rotatedBitmap, (rotatedBitmap.width * scale).toInt(), (rotatedBitmap.height * scale).toInt(), true)
            } else {
                rotatedBitmap
            }

            val outStream = ByteArrayOutputStream()
            scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 85, outStream)
            val bytes = outStream.toByteArray()
            val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            Pair(scaledBitmap, b64)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
