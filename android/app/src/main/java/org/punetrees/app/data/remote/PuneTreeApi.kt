package org.punetrees.app.data.remote

import org.punetrees.app.data.remote.model.*
import retrofit2.Response
import retrofit2.http.*

interface PuneTreeApi {

    @POST("api/v1/complaints/check-duplicate")
    suspend fun checkDuplicate(
        @Body request: DuplicateCheckRequest
    ): Response<DuplicateCheckResponse>

    @POST("api/v1/complaints/upvote-witness")
    suspend fun upvoteWitness(
        @Body request: UpvoteWitnessRequest
    ): Response<Map<String, Any>>

    @POST("api/v1/complaints/analyze-and-draft")
    suspend fun analyzeAndDraft(
        @Body request: AnalyzeAndDraftRequest
    ): Response<AnalyzeAndDraftResponse>

    @POST("api/v1/complaints/render-pdf")
    suspend fun renderPdf(
        @Body request: RenderPdfRequest
    ): Response<RenderPdfResponse>

    @POST("api/v1/complaints/dispatch")
    suspend fun dispatchComplaint(
        @Body request: DispatchRequest
    ): Response<DispatchResponse>

    @POST("api/v1/complaints/{id}/verify")
    suspend fun verifyResolution(
        @Path("id") id: String,
        @Body request: ReverifyRequest
    ): Response<ReverifyResponse>

    @GET("api/v1/complaints/")
    suspend fun listComplaints(): Response<List<ComplaintListItem>>

    @GET("api/v1/complaints/{id}")
    suspend fun getComplaintDetail(
        @Path("id") id: String
    ): Response<ComplaintDetailResponse>
}
