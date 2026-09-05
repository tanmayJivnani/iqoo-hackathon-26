package org.punetrees.app.data.remote

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    // Local development host for physical device on Wi-Fi
    var baseUrl: String = "http://192.168.1.9:8000/"

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private var cachedService: PuneTreeApi? = null
    private var lastBaseUrl: String = ""

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    fun getService(): PuneTreeApi {
        if (cachedService != null && lastBaseUrl == baseUrl) {
            return cachedService!!
        }
        lastBaseUrl = baseUrl
        val service = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(PuneTreeApi::class.java)
        cachedService = service
        return service
    }
}