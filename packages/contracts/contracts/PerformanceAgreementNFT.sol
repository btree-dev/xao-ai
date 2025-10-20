// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/// @title PerformanceAgreementNFT
/// @notice ERC721 token representing a performance agreement between an artist and a venue.
/// @dev Each token stores agreement metadata on-chain and can produce a JSON tokenURI.
contract PerformanceAgreementNFT is ERC721URIStorage, Ownable, EIP712 {
    using Strings for uint256;

    struct Agreement {
        string venueName;
        string venueAddress; // Physical address
        uint64 startTime; // unix timestamp of event start
        uint32 durationMinutes; // duration in minutes
        string artistSocialHandle; // e.g. twitter @artist
        string venueSocialHandle; // e.g. twitter @venue
        address artistWallet;
        address venueWallet;
        uint256 paymentAmountUsdCents; // Agreed payment in USD cents
        Status status; // Lifecycle status
        bool paymentRecorded; // true once payment acknowledged
    }

    enum Status { Scheduled, Completed, Disputed, Resolved, Finalized }

    struct AgreementInput {
        string venueName;
        string venueAddress;
        uint64 startTime;
        uint32 durationMinutes;
        string artistSocialHandle;
        string venueSocialHandle;
        address artistWallet;
        address venueWallet;
        uint256 paymentAmountUsdCents;
    }

    bytes32 private constant AGREEMENT_TYPEHASH = keccak256(
        "AgreementInput(string venueName,string venueAddress,uint64 startTime,uint32 durationMinutes,string artistSocialHandle,string venueSocialHandle,address artistWallet,address venueWallet,uint256 paymentAmountUsdCents)"
    );
    bytes32 private constant ARTIST_FINALIZE_TYPEHASH = keccak256(
        "ArtistFinalize(uint256 venueTokenId,address artistWallet)"
    );

    // tokenId => Agreement
    mapping(uint256 => Agreement) private _agreements;
    // venueTokenId => artistTokenId (0 if not finalized yet)
    mapping(uint256 => uint256) public artistTokenOfVenue;
    // artistTokenId => venueTokenId
    mapping(uint256 => uint256) public venueTokenOfArtistToken;
    uint256 private _nextId = 1;

    event AgreementCreated(
        uint256 indexed tokenId,
        address indexed artistWallet,
        address indexed venueWallet,
        string venueName,
        uint64 startTime,
        uint256 paymentAmountUsdCents
    );
    event AgreementSignedAndMinted(uint256 indexed tokenId, address indexed venueWallet, address indexed artistWallet); // legacy single-phase
    event VenueAgreementCreated(uint256 indexed venueTokenId, address indexed venueWallet, address indexed artistWallet);
    event ArtistAgreementFinalized(uint256 indexed venueTokenId, uint256 indexed artistTokenId, address indexed artistWallet);
    event StatusChanged(uint256 indexed tokenId, Status previous, Status current, address actor);
    event PaymentRecorded(uint256 indexed tokenId, uint256 amountUsdCents, address recorder);

    constructor() ERC721("PerformanceAgreement", "PERFAGRM") Ownable(msg.sender) EIP712("PerformanceAgreementNFT", "1") {}

    /// @notice Create a new performance agreement NFT.
    function createAgreement(
        string calldata venueName,
        string calldata venueAddress,
        uint64 startTime,
        uint32 durationMinutes,
        string calldata artistSocialHandle,
        string calldata venueSocialHandle,
        address artistWallet,
        address venueWallet,
        uint256 paymentAmountUsdCents
    ) external returns (uint256 tokenId) {
        require(artistWallet != address(0), "Artist wallet zero");
        require(venueWallet != address(0), "Venue wallet zero");
        require(startTime > block.timestamp - 1 days, "Start time too old");
        require(durationMinutes > 0 && durationMinutes <= 24 * 60, "Invalid duration");
        require(paymentAmountUsdCents > 0, "Payment must be > 0");

        tokenId = _nextId++;
        _agreements[tokenId] = Agreement({
            venueName: venueName,
            venueAddress: venueAddress,
            startTime: startTime,
            durationMinutes: durationMinutes,
            artistSocialHandle: artistSocialHandle,
            venueSocialHandle: venueSocialHandle,
            artistWallet: artistWallet,
            venueWallet: venueWallet,
            paymentAmountUsdCents: paymentAmountUsdCents,
            status: Status.Scheduled,
            paymentRecorded: false
        });

        _safeMint(msg.sender, tokenId);
        emit AgreementCreated(tokenId, artistWallet, venueWallet, venueName, startTime, paymentAmountUsdCents);
    }

    modifier onlyParticipant(uint256 tokenId) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        Agreement memory a = _agreements[tokenId];
        require(msg.sender == a.artistWallet || msg.sender == a.venueWallet, "Not participant");
        _;
    }

    function markCompleted(uint256 tokenId) external onlyParticipant(tokenId) {
        Agreement storage a = _agreements[tokenId];
        require(a.status == Status.Scheduled, "Bad status");
        Status previous = a.status;
        a.status = Status.Completed;
        emit StatusChanged(tokenId, previous, a.status, msg.sender);
    }

    function raiseDispute(uint256 tokenId) external onlyParticipant(tokenId) {
        Agreement storage a = _agreements[tokenId];
        require(a.status == Status.Completed, "Must be completed");
        Status previous = a.status;
        a.status = Status.Disputed;
        emit StatusChanged(tokenId, previous, a.status, msg.sender);
    }

    function resolveDispute(uint256 tokenId) external onlyOwner {
        Agreement storage a = _agreements[tokenId];
        require(a.status == Status.Disputed, "Not disputed");
        Status previous = a.status;
        a.status = Status.Resolved;
        emit StatusChanged(tokenId, previous, a.status, msg.sender);
    }

    function recordPayment(uint256 tokenId) external onlyParticipant(tokenId) {
        Agreement storage a = _agreements[tokenId];
        require(
            a.status == Status.Completed ||
            a.status == Status.Resolved ||
            a.status == Status.Finalized,
            "Invalid status for payment"
        );
        require(!a.paymentRecorded, "Already recorded");
        a.paymentRecorded = true;
        emit PaymentRecorded(tokenId, a.paymentAmountUsdCents, msg.sender);
    }

    /// @notice Creates agreement NFT after artist has signed off-chain.
    function createAgreementWithArtistSig(AgreementInput calldata input, bytes calldata artistSignature) external returns (uint256 tokenId) {
        require(msg.sender == input.venueWallet, "Caller not venue wallet");
        require(input.artistWallet != address(0) && input.venueWallet != address(0), "Zero address");
        require(input.startTime > block.timestamp - 1 days, "Start time too old");
        require(input.durationMinutes > 0 && input.durationMinutes <= 24 * 60, "Invalid duration");
        require(input.paymentAmountUsdCents > 0, "Payment must be > 0");

        bytes32 structHash = keccak256(abi.encode(
            AGREEMENT_TYPEHASH,
            keccak256(bytes(input.venueName)),
            keccak256(bytes(input.venueAddress)),
            input.startTime,
            input.durationMinutes,
            keccak256(bytes(input.artistSocialHandle)),
            keccak256(bytes(input.venueSocialHandle)),
            input.artistWallet,
            input.venueWallet,
            input.paymentAmountUsdCents
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, artistSignature);
        require(signer == input.artistWallet, "Bad artist signature");

        tokenId = _nextId++;
        _agreements[tokenId] = Agreement({
            venueName: input.venueName,
            venueAddress: input.venueAddress,
            startTime: input.startTime,
            durationMinutes: input.durationMinutes,
            artistSocialHandle: input.artistSocialHandle,
            venueSocialHandle: input.venueSocialHandle,
            artistWallet: input.artistWallet,
            venueWallet: input.venueWallet,
            paymentAmountUsdCents: input.paymentAmountUsdCents,
            status: Status.Scheduled,
            paymentRecorded: false
        });

        _safeMint(input.artistWallet, tokenId);
        emit AgreementCreated(tokenId, input.artistWallet, input.venueWallet, input.venueName, input.startTime, input.paymentAmountUsdCents);
        emit AgreementSignedAndMinted(tokenId, input.venueWallet, input.artistWallet);
    }

    function getAgreement(uint256 tokenId) external view returns (Agreement memory) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        return _agreements[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        Agreement memory a = _agreements[tokenId];

        string memory json = string(abi.encodePacked(
            '{',
                '"name":"Performance Agreement #', tokenId.toString(), '",',
                '"description":"Agreement between artist and venue for a performance event.",',
                '"venueName":"', a.venueName, '",',
                '"venueAddress":"', a.venueAddress, '",',
                '"startTime":', uint256(a.startTime).toString(), ',',
                '"durationMinutes":', uint256(a.durationMinutes).toString(), ',',
                '"artistSocialHandle":"', a.artistSocialHandle, '",',
                '"venueSocialHandle":"', a.venueSocialHandle, '",',
                '"artistWallet":"', _toHexString(a.artistWallet), '",',
                '"venueWallet":"', _toHexString(a.venueWallet), '",',
                '"paymentAmountUsdCents":', a.paymentAmountUsdCents.toString(), ',',
                '"status":"', _statusToString(a.status), '",',
                '"paymentRecorded":', a.paymentRecorded ? "true" : "false",
            '}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _toHexString(address account) internal pure returns (string memory) {
        return Strings.toHexString(uint256(uint160(account)), 20);
    }

    function _statusToString(Status s) internal pure returns (string memory) {
        if (s == Status.Scheduled) return "Scheduled";
        if (s == Status.Completed) return "Completed";
        if (s == Status.Disputed) return "Disputed";
        if (s == Status.Resolved) return "Resolved";
        if (s == Status.Finalized) return "Finalized";
        return "Scheduled"; // fallback (should not hit)
    }

    /// @notice Returns how many agreements have been minted so far.
    function totalMinted() external view returns (uint256) {
        return _nextId - 1; // _nextId starts at 1
    }

    /// @notice Returns the next tokenId that will be used when minting.
    function nextTokenId() external view returns (uint256) {
        return _nextId;
    }

    /// @notice Enumerate all tokenIds owned by an address (linear scan).
    /// @dev O(n) over total minted; acceptable for small counts. For large sets, use off-chain indexing.
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 minted = _nextId - 1;
        uint256 count = balanceOf(owner);
        uint256[] memory result = new uint256[](count);
        if (count == 0) return result;
        uint256 idx = 0;
        for (uint256 tokenId = 1; tokenId <= minted; tokenId++) {
            if (_ownerOf(tokenId) == owner) {
                result[idx++] = tokenId;
                if (idx == count) break; // early exit
            }
        }
        return result;
    }

    // -------- Two-phase flow --------
    /// @notice Phase 1: Venue creates an agreement NFT without artist signature.
    /// @dev Minted to the venue wallet; later artist finalizes & mints their own linked NFT.
    function createVenueAgreement(AgreementInput calldata input) external returns (uint256 venueTokenId) {
        require(msg.sender == input.venueWallet, "Caller not venue wallet");
        require(input.artistWallet != address(0) && input.venueWallet != address(0), "Zero address");
        require(input.startTime > block.timestamp - 1 days, "Start time too old");
        require(input.durationMinutes > 0 && input.durationMinutes <= 24 * 60, "Invalid duration");
        require(input.paymentAmountUsdCents > 0, "Payment must be > 0");

        venueTokenId = _nextId++;
        _agreements[venueTokenId] = Agreement({
            venueName: input.venueName,
            venueAddress: input.venueAddress,
            startTime: input.startTime,
            durationMinutes: input.durationMinutes,
            artistSocialHandle: input.artistSocialHandle,
            venueSocialHandle: input.venueSocialHandle,
            artistWallet: input.artistWallet,
            venueWallet: input.venueWallet,
            paymentAmountUsdCents: input.paymentAmountUsdCents,
            status: Status.Scheduled,
            paymentRecorded: false
        });

        _safeMint(input.venueWallet, venueTokenId);
        emit AgreementCreated(venueTokenId, input.artistWallet, input.venueWallet, input.venueName, input.startTime, input.paymentAmountUsdCents);
        emit VenueAgreementCreated(venueTokenId, input.venueWallet, input.artistWallet);
    }

    /// @notice Phase 2: Artist finalizes an existing venue agreement and mints their own NFT.
    /// @param venueTokenId The token id of the venue-created agreement.
    /// @param artistSignature EIP-712 signature over (venueTokenId, artistWallet).
    /// @return artistTokenId Newly minted artist agreement token id.
    function artistFinalizeAndMint(uint256 venueTokenId, bytes calldata artistSignature) external returns (uint256 artistTokenId) {
        require(_ownerOf(venueTokenId) != address(0), "Venue token nonexistent");
        require(artistTokenOfVenue[venueTokenId] == 0, "Already finalized");
        Agreement storage venueAgreement = _agreements[venueTokenId];
        require(venueAgreement.status == Status.Scheduled, "Bad status");
        // Prepare struct hash for signature verification
        bytes32 structHash = keccak256(abi.encode(
            ARTIST_FINALIZE_TYPEHASH,
            venueTokenId,
            venueAgreement.artistWallet
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, artistSignature);
        require(signer == venueAgreement.artistWallet, "Bad artist signature");
        require(msg.sender == venueAgreement.artistWallet, "Caller not artist wallet");

        artistTokenId = _nextId++;
        _agreements[artistTokenId] = Agreement({
            venueName: venueAgreement.venueName,
            venueAddress: venueAgreement.venueAddress,
            startTime: venueAgreement.startTime,
            durationMinutes: venueAgreement.durationMinutes,
            artistSocialHandle: venueAgreement.artistSocialHandle,
            venueSocialHandle: venueAgreement.venueSocialHandle,
            artistWallet: venueAgreement.artistWallet,
            venueWallet: venueAgreement.venueWallet,
            paymentAmountUsdCents: venueAgreement.paymentAmountUsdCents,
            status: Status.Finalized,
            paymentRecorded: false
        });
        venueAgreement.status = Status.Finalized;
        artistTokenOfVenue[venueTokenId] = artistTokenId;
        venueTokenOfArtistToken[artistTokenId] = venueTokenId;
        _safeMint(venueAgreement.artistWallet, artistTokenId);
        emit AgreementCreated(artistTokenId, venueAgreement.artistWallet, venueAgreement.venueWallet, venueAgreement.venueName, venueAgreement.startTime, venueAgreement.paymentAmountUsdCents);
        emit ArtistAgreementFinalized(venueTokenId, artistTokenId, venueAgreement.artistWallet);
        emit StatusChanged(venueTokenId, Status.Scheduled, Status.Finalized, venueAgreement.artistWallet);
    }

    /// @notice Returns the linked artist token id for a venue agreement (0 if not finalized yet).
    function getArtistTokenForVenue(uint256 venueTokenId) external view returns (uint256) {
        return artistTokenOfVenue[venueTokenId];
    }
}
