using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Models;
using DecisionWorkspace.Api.Services;

namespace DecisionWorkspace.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DecisionsController : ControllerBase
    {
        private readonly DecisionService _decisionService;
        public DecisionsController(DecisionService decisionService)
        {
            _decisionService = decisionService;
        }

        [HttpPost]
        public async Task<IActionResult> Create(CreateDecisionRequest request)
        {
            var decision = await _decisionService.CreateAsync(request);

            return Ok(decision);
        }
    }
}
