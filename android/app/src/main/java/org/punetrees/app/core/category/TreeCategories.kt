package org.punetrees.app.core.category

data class PhotoStepGuide(
    val stepTitle: String,
    val previewLabel: String,
    val instruction: String,
    val badge: String
)

data class TreeCategory(
    val key: String,
    val title: String,
    val description: String,
    val photoSteps: List<PhotoStepGuide>,
    val customGrounding: List<String> = emptyList()
) {
    val statutoryGrounding: List<String>
        get() = if (customGrounding.isNotEmpty()) customGrounding else when (key) {
            "ILLEGAL_FELLING" -> listOf(
                "Section 8 & 21 - Maharashtra Tree Act 1975: Cognizable Offence for unauthorized felling/sabotage",
                "PMC Tree Authority Mandate: Zero tolerance for tree destruction without prior gazetted notice"
            )
            "UNAUTHORIZED_PRUNING" -> listOf(
                "Section 8 & 21 - Maharashtra Tree Act 1975: Heavy branch lopping or header chopping requires explicit permit",
                "Urban Tree Canopy Preservation Norms: Balanced arborist crown reduction only"
            )
            "ROOT_CONCRETIZATION" -> listOf(
                "Section 2(c) - Tree Act 1975: Suffocating or choking root basin constitutes statutory tree damage",
                "Bombay High Court Mandate: Mandatory 1-meter unpaved breathing soil basin around all street trees"
            )
            "NAILS_BOARDS_CABLE_STRANGULATION" -> listOf(
                "Section 2(c) - Tree Act 1975: Driving metal nails, advertising boards, or strangling cables damages live cambium",
                "PMC Public Notice: Immediate de-nailing and removal of commercial defacement from avenue trees"
            )
            "DANGEROUS_LEANING_FALL_RISK", "HAZARDOUS_BRANCH" -> listOf(
                "Section 8 & 19 - Maharashtra Tree Act 1975: Emergency public safety removal / stabilization of hazardous trees",
                "PMC Disaster Management Charter: 48-hour emergency tree ambulance response window"
            )
            else -> listOf(
                "Maharashtra (Urban Areas) Protection and Preservation of Trees Act, 1975",
                "Section 2(c) & Section 21: Damaging or sabotaging protected urban vegetation"
            )
        }

    val formalSubjectName: String
        get() = when (key) {
            "ROOT_CONCRETIZATION" -> "Severe Root Basin Concretization"
            "DANGEROUS_LEANING_FALL_RISK" -> "Dangerous Leaning Tree & Fall Risk"
            "ILLEGAL_FELLING" -> "Illegal Tree Felling / Cutting"
            "UNAUTHORIZED_PRUNING" -> "Unauthorized Excessive Tree Pruning"
            "NAILS_BOARDS_CABLE_STRANGULATION" -> "Tree Defacement (Nails, Boards & Cable Strangulation)"
            "HAZARDOUS_BRANCH" -> "Hazardous Overhanging Tree Limb"
            else -> title.replace(Regex("""[\p{So}\p{Sk}\p{Cs}\p{Cn}\p{Co}]"""), "").trim()
        }
}

fun sanitizeEmailSubject(raw: String): String {
    return raw
        // Remove emoji and pictographs
        .replace(Regex("""[\p{So}\p{Sk}\p{Cs}\p{Cn}\p{Co}]"""), "")
        // Clean up double spaces or dangling hyphens/ampersands
        .replace(Regex("""\s+"""), " ")
        .replace(" - & ", " & ")
        .trim()
}

object TreeCategories {

    val ALL: List<TreeCategory> = listOf(
        TreeCategory(
            key = "DANGEROUS_LEANING_FALL_RISK",
            title = "⚠️ Leaning Tree / Fall Risk",
            description = "Trunk with dangerous tilt leaning over road, powerlines, or buildings.",
            photoSteps = listOf(
                PhotoStepGuide(
                    stepTitle = "Photo 1 of 3: Wide Full Tree & Lean",
                    previewLabel = "1. Wide Angle (Full Tree & Street Locus)",
                    instruction = "Step back 5–10m across street. Capture full tree aligned against building or pole to show lean trajectory.",
                    badge = "Locus Context"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 2 of 3: Trunk Lean Angle & Vector",
                    previewLabel = "2. Mid-Range (Trunk Angle & Curvature)",
                    instruction = "Frame the trunk from mid-distance against vertical landmarks to calculate tilt angle and structural stress.",
                    badge = "Trunk Angle"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 3 of 3: Root Plate & Soil Base",
                    previewLabel = "3. Close-up (Root Plate & Soil Heave)",
                    instruction = "Close-up of ground soil at base. Check if root plate is lifting, soil is cracking, or roots are snapping.",
                    badge = "Root Plate"
                )
            )
        ),
        TreeCategory(
            key = "ILLEGAL_FELLING",
            title = "🪓 Illegal Tree Felling & Sabotage",
            description = "Tree being cut, sawn stump, chemical poisoning, girdling, or base burning.",
            photoSteps = listOf(
                PhotoStepGuide(
                    stepTitle = "Photo 1 of 3: Avenue Context & Canopy Gap",
                    previewLabel = "1. Wide Angle (Avenue Gap & Site Context)",
                    instruction = "Step back across the street. Capture the missing tree gap in the avenue canopy or work site clearing.",
                    badge = "Avenue Gap"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 2 of 3: Felled Timber & Work Area",
                    previewLabel = "2. Mid-Range (Felled Logs & Branches)",
                    instruction = "Frame the severed timber logs, stacked branches, or felling activity on site.",
                    badge = "Timber Logs"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 3 of 3: Sawn Stump / Base Damage",
                    previewLabel = "3. Close-up (Stump Base / Saw Cuts / Sabotage)",
                    instruction = "Close-up of stump or tree base showing fresh saw tooth marks, tool grooves, acid holes, or girdling ring.",
                    badge = "Stump / Base"
                )
            )
        ),
        TreeCategory(
            key = "UNAUTHORIZED_PRUNING",
            title = "✂️ Unauthorized Heavy Pruning",
            description = "Excessive hacking of large limbs, decapitation of canopy, or unscientific cutting.",
            photoSteps = listOf(
                PhotoStepGuide(
                    stepTitle = "Photo 1 of 3: Wide Canopy & Crown Ruin",
                    previewLabel = "1. Wide Angle (Hacked Canopy & Crown Balance)",
                    instruction = "Capture the entire tree showing unscientific canopy decapitation, flat topping, or one-sided hacking.",
                    badge = "Crown Overview"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 2 of 3: Main Scaffold Limbs",
                    previewLabel = "2. Mid-Range (Scaffold Limbs & Cutting Level)",
                    instruction = "Frame the main trunk joints where primary structural limbs were severed.",
                    badge = "Scaffold Cuts"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 3 of 3: Severed Branch Stubs",
                    previewLabel = "3. Close-up (Severed Stubs & Torn Bark)",
                    instruction = "Close-up macro of branch stubs showing cut diameter (>10cm is illegal without sanction) and torn bark.",
                    badge = "Cut Stubs"
                )
            )
        ),
        TreeCategory(
            key = "HAZARDOUS_BRANCH",
            title = "🌿 Hazardous Broken Branch",
            description = "Fractured, hanging, or cracked heavy limbs threatening pedestrians/traffic.",
            photoSteps = listOf(
                PhotoStepGuide(
                    stepTitle = "Photo 1 of 3: Street Clearance & Target View",
                    previewLabel = "1. Wide Angle (Street Clearance & Traffic Target)",
                    instruction = "Capture the whole tree showing where the hanging branch hangs directly above road, sidewalk, or powerlines.",
                    badge = "Traffic Target"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 2 of 3: Limb Attachment Joint",
                    previewLabel = "2. Mid-Range (Branch Attachment to Trunk)",
                    instruction = "Frame the limb attachment to the main tree showing where the structural failure started.",
                    badge = "Limb Joint"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 3 of 3: Fracture Split & Wood Tear",
                    previewLabel = "3. Close-up (Fracture Split / Hanging Crack)",
                    instruction = "Close-up macro of the split wood, crack joint, or rotting union threatening immediate collapse.",
                    badge = "Fracture Split"
                )
            )
        ),
        TreeCategory(
            key = "ROOT_CONCRETIZATION",
            title = "🧱 Root Concretization",
            description = "Asphalt, paver blocks, or concrete choking the 1-meter soil basin around roots.",
            photoSteps = listOf(
                PhotoStepGuide(
                    stepTitle = "Photo 1 of 3: Footpath & Street Overview",
                    previewLabel = "1. Wide Angle (Footpath Setting & Road Extent)",
                    instruction = "Step back 5m. Capture the tree position along the paved footpath or road construction.",
                    badge = "Footpath Setting"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 2 of 3: Paving Extent Around Trunk",
                    previewLabel = "2. Mid-Range (Paving Coverage Around Trunk)",
                    instruction = "Frame the lower 2 meters of trunk and surrounding paving/bitumen coverage.",
                    badge = "Paving Coverage"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 3 of 3: Choked Root Collar Macro",
                    previewLabel = "3. Close-up (Concrete Touching Live Bark)",
                    instruction = "Close-up macro showing concrete, asphalt, or paver blocks directly touching bark with zero mandatory 1m green basin.",
                    badge = "Choked Collar"
                )
            )
        ),
        TreeCategory(
            key = "DISEASE_PEST",
            title = "🐛 Disease / Termite Decay",
            description = "Hollow trunk, fungal conks, severe termite infestation, or rotting bark.",
            photoSteps = listOf(
                PhotoStepGuide(
                    stepTitle = "Photo 1 of 3: Overall Canopy Vigour",
                    previewLabel = "1. Wide Angle (Canopy Vigour & Dieback)",
                    instruction = "Capture the whole tree showing dead branches, bare crown, or severe foliage yellowing.",
                    badge = "Canopy Vigour"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 2 of 3: Affected Trunk & Scaffold Area",
                    previewLabel = "2. Mid-Range (Trunk Infestation / Hollow Zone)",
                    instruction = "Frame the infected section of the trunk or main limbs showing the spread of structural decay.",
                    badge = "Infected Zone"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 3 of 3: Fungal Conks / Termite Cavity",
                    previewLabel = "3. Close-up (Fungal Conk / Termite Mud / Rot)",
                    instruction = "Close-up macro of fungal brackets/conks, termite mud trails, weeping sap, or hollow trunk cavities.",
                    badge = "Fungal / Termites"
                )
            )
        ),
        TreeCategory(
            key = "NAILS_BOARDS_CABLE_STRANGULATION",
            title = "📌 Nails, Banners, Cables & Lighting",
            description = "Commercial boards nailed to bark, tight cables, or lighting suffocating trunk.",
            photoSteps = listOf(
                PhotoStepGuide(
                    stepTitle = "Photo 1 of 3: Tree & Street Defacement",
                    previewLabel = "1. Wide Angle (Street Tree & Commercial Defacement)",
                    instruction = "Capture the full street tree showing advertising boards, metal signs, or commercial lighting attached.",
                    badge = "Street Defacement"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 2 of 3: Trunk Clutter & Cable Wrap",
                    previewLabel = "2. Mid-Range (Trunk Clutter & Cable Extent)",
                    instruction = "Frame the trunk showing the number of nailed boards, metal brackets, or heavy cables wrapped around it.",
                    badge = "Trunk Clutter"
                ),
                PhotoStepGuide(
                    stepTitle = "Photo 3 of 3: Nails Piercing Bark / Cable Strangulation",
                    previewLabel = "3. Close-up (Nails in Bark / Tight Cable Choke)",
                    instruction = "Close-up macro of iron nails driven into live cambium bark, metal clamps, or cables cutting into trunk.",
                    badge = "Nails in Bark"
                )
            )
        )
    )

    fun getByKey(key: String): TreeCategory {
        val cleanKey = if (key.contains(",")) key.substringBefore(",") else key
        return ALL.find { it.key == cleanKey } ?: ALL[0]
    }
}
